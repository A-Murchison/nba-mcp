import type { ProviderCapabilities } from "../domain/capabilities.js";
import type {
  BoxScore, Game, GameBoxScoreResponse, GamesThisWeekResponse, GameStatus, GameStatusResponse, LiveGame, LiveGamesResponse,
  LeagueLeader, LeagueLeadersResponse, Player, PlayerBoxScore, PlayerGameLogResponse, PlayerSeasonStatsResponse, PlayByPlayEvent, RecentGameEventsResponse, ResponseMetadata, Roster,
  SearchPlayersResponse, SearchTeamsResponse, Team, TeamBoxScore, TeamGameLogResponse, TeamRosterResponse, TeamSeasonStatsResponse, TodaysGamesResponse, TraditionalStats,
} from "../domain/models.js";
import type { DataProvider, GetGamesThisWeekInput, GetHistoricalGameEventsInput, GetLeagueLeadersInput, GetLeagueStandingsInput, GetPlayerGameLogInput, GetPlayerSeasonStatsInput, GetRecentGameEventsInput, GetTeamGameLogInput, GetTeamSeasonStatsInput, GetTodaysGamesInput, SearchPlayersInput } from "./DataProvider.js";
import { ProviderError } from "./ProviderError.js";
import { canonicalNbaTeam, nbaTeam, searchNbaTeams } from "./nbaTeams.js";

type JsonObject = Record<string, unknown>;

const LIVE_BASE_URL = "https://cdn.nba.com/static/json/liveData";
const SCHEDULE_URL = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json";
const STATS_BASE_URL = "https://stats.nba.com/stats";
// Match the headers used by nba.com's scoreboard browser request. Node fetch manages
// Host, compression, and transfer encoding itself, so those curl-only headers are omitted.
const BROWSER_FETCH_HEADERS = Object.freeze({
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nba.com",
  Referer: "https://www.nba.com/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  Priority: "u=4",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0",
});
const STATS_HEADERS = Object.freeze({
  ...BROWSER_FETCH_HEADERS,
  Accept: "application/json, text/plain, */*",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  // Public request-identification headers used by NBA Stats browser clients.
  // They are not credentials and must never be replaced with cookies or tokens.
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
});
const LIVE_HEADERS = BROWSER_FETCH_HEADERS;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RATE_LIMIT_RETRIES = 2;
const DEFAULT_RATE_LIMIT_RETRY_MS = 1_000;

function object(value: unknown): JsonObject { return value !== null && typeof value === "object" ? value as JsonObject : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}
function number(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function requiredText(value: unknown, fallback = ""): string { return text(value) ?? fallback; }
function requiredNumber(value: unknown, fallback = 0): number { return number(value) ?? fallback; }
function scheduleDate(value: unknown, fallback: string): string {
  const date = text(value);
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(date ?? "");
  if (iso) return iso[1]!;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(date ?? "");
  return us ? `${us[3]!}-${us[1]!.padStart(2, "0")}-${us[2]!.padStart(2, "0")}` : fallback;
}
function isLive(state: GameStatus["state"]): boolean { return state === "in_progress" || state === "halftime"; }
function displayClock(value: string): string {
  const match = /^PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value);
  if (!match) return value;
  return `${match[1] ?? "0"}:${Math.floor(Number(match[2] ?? 0)).toString().padStart(2, "0")}`;
}
function headersFor(url: string) {
  const host = new URL(url).hostname;
  if (host === "stats.nba.com") return STATS_HEADERS;
  if (host === "cdn.nba.com") return LIVE_HEADERS;
  return BROWSER_FETCH_HEADERS;
}
function statsUrl(endpoint: string, parameters: Record<string, string>): string {
  const url = new URL(`${STATS_BASE_URL}/${endpoint}`);
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);
  return url.toString();
}
interface StatsTable { headers: string[]; rows: unknown[][]; }
function statsTable(data: JsonObject, name: string): StatsTable {
  const singularResultSet = object(data.resultSet);
  const tables = [...array(data.resultSets), ...array(data.resultSet), ...(text(singularResultSet.name) ? [singularResultSet] : [])].map(object);
  const table = tables.find((candidate) => requiredText(candidate.name) === name);
  if (!table) throw new ProviderError("PROVIDER_UNAVAILABLE", `nba.com did not return the '${name}' result set.`);
  return { headers: array(table.headers).map(String), rows: array(table.rowSet).map(array) };
}
function statsValue(table: StatsTable, row: unknown[], name: string): unknown {
  const index = table.headers.indexOf(name);
  return index < 0 ? undefined : row[index];
}
function statsNumber(table: StatsTable, row: unknown[], ...names: string[]): number | undefined {
  for (const name of names) {
    const value = number(statsValue(table, row, name));
    if (value !== undefined) return value;
  }
  return undefined;
}
function setStat(target: TraditionalStats, key: keyof TraditionalStats, value: number | undefined): void {
  if (value !== undefined) target[key] = value;
}
function traditionalStats(table: StatsTable, row: unknown[]): TraditionalStats {
  const result: TraditionalStats = {};
  setStat(result, "gamesPlayed", statsNumber(table, row, "GP"));
  setStat(result, "gamesStarted", statsNumber(table, row, "GS"));
  setStat(result, "minutes", statsNumber(table, row, "MIN"));
  setStat(result, "points", statsNumber(table, row, "PTS"));
  setStat(result, "rebounds", statsNumber(table, row, "REB"));
  setStat(result, "offensiveRebounds", statsNumber(table, row, "OREB"));
  setStat(result, "defensiveRebounds", statsNumber(table, row, "DREB"));
  setStat(result, "assists", statsNumber(table, row, "AST"));
  setStat(result, "steals", statsNumber(table, row, "STL"));
  setStat(result, "blocks", statsNumber(table, row, "BLK"));
  setStat(result, "turnovers", statsNumber(table, row, "TOV"));
  setStat(result, "fouls", statsNumber(table, row, "PF"));
  setStat(result, "fieldGoalsMade", statsNumber(table, row, "FGM"));
  setStat(result, "fieldGoalsAttempted", statsNumber(table, row, "FGA"));
  setStat(result, "threePointersMade", statsNumber(table, row, "FG3M", "FG3_M"));
  setStat(result, "threePointersAttempted", statsNumber(table, row, "FG3A", "FG3_A"));
  setStat(result, "freeThrowsMade", statsNumber(table, row, "FTM"));
  setStat(result, "freeThrowsAttempted", statsNumber(table, row, "FTA"));
  setStat(result, "wins", statsNumber(table, row, "W"));
  setStat(result, "losses", statsNumber(table, row, "L"));
  return result;
}
function isSeasonLabel(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return match !== null && Number(match[2]) === (Number(match[1]) + 1) % 100;
}
function historicalPlayerInput(input: GetPlayerSeasonStatsInput | GetPlayerGameLogInput): { playerId: string; season: string; seasonType: "Regular Season" | "Playoffs"; perMode: "PerGame" | "Totals" } {
  const playerId = input.playerId.trim();
  if (!playerId) throw new ProviderError("INVALID_ARGUMENT", "playerId must not be empty.");
  if (!isSeasonLabel(input.season)) throw new ProviderError("INVALID_ARGUMENT", "season must use consecutive YYYY-YY years.");
  const seasonType = input.seasonType ?? "Regular Season";
  if (seasonType !== "Regular Season" && seasonType !== "Playoffs") throw new ProviderError("INVALID_ARGUMENT", "seasonType must be Regular Season or Playoffs.");
  const perMode = input.perMode ?? "PerGame";
  if (perMode !== "PerGame" && perMode !== "Totals") throw new ProviderError("INVALID_ARGUMENT", "perMode must be PerGame or Totals.");
  return { playerId, season: input.season, seasonType, perMode };
}
function historicalTeamInput(input: GetTeamSeasonStatsInput | GetTeamGameLogInput): { team: Team; season: string; seasonType: "Regular Season" | "Playoffs"; perMode: "PerGame" | "Totals" } {
  const team = canonicalNbaTeam(input.teamId);
  if (!team) throw new ProviderError("NOT_FOUND", `NBA team '${input.teamId}' was not found.`);
  if (!isSeasonLabel(input.season)) throw new ProviderError("INVALID_ARGUMENT", "season must use consecutive YYYY-YY years.");
  const seasonType = input.seasonType ?? "Regular Season";
  if (seasonType !== "Regular Season" && seasonType !== "Playoffs") throw new ProviderError("INVALID_ARGUMENT", "seasonType must be Regular Season or Playoffs.");
  const perMode = input.perMode ?? "PerGame";
  if (perMode !== "PerGame" && perMode !== "Totals") throw new ProviderError("INVALID_ARGUMENT", "perMode must be PerGame or Totals.");
  return { team, season: input.season, seasonType, perMode };
}
const LEADER_STAT_CATEGORIES = new Set(["PTS", "REB", "AST", "STL", "BLK", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "MIN"]);
function historicalLeagueLeadersInput(input: GetLeagueLeadersInput): { season: string; seasonType: "Regular Season" | "Playoffs"; perMode: "PerGame" | "Totals"; statCategory: string; limit: number; offset: number } {
  if (!isSeasonLabel(input.season)) throw new ProviderError("INVALID_ARGUMENT", "season must use consecutive YYYY-YY years.");
  const seasonType = input.seasonType ?? "Regular Season";
  if (seasonType !== "Regular Season" && seasonType !== "Playoffs") throw new ProviderError("INVALID_ARGUMENT", "seasonType must be Regular Season or Playoffs.");
  const perMode = input.perMode ?? "PerGame";
  if (perMode !== "PerGame" && perMode !== "Totals") throw new ProviderError("INVALID_ARGUMENT", "perMode must be PerGame or Totals.");
  const statCategory = input.statCategory.trim().toUpperCase();
  if (!LEADER_STAT_CATEGORIES.has(statCategory)) throw new ProviderError("INVALID_ARGUMENT", `statCategory must be one of: ${[...LEADER_STAT_CATEGORIES].join(", ")}.`);
  return { season: input.season, seasonType, perMode, statCategory, ...pageInput(input.limit, input.cursor) };
}
function isoDate(value: string | undefined, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) {
    throw new ProviderError("INVALID_ARGUMENT", `${name} must use YYYY-MM-DD format.`);
  }
  return value;
}
function pageInput(limit: number | undefined, cursor: string | undefined): { limit: number; offset: number } {
  const resolvedLimit = limit ?? 100;
  if (!Number.isInteger(resolvedLimit) || resolvedLimit < 1 || resolvedLimit > 100) throw new ProviderError("INVALID_ARGUMENT", "limit must be an integer from 1 through 100.");
  if (cursor === undefined) return { limit: resolvedLimit, offset: 0 };
  if (!/^(0|[1-9]\d*)$/.test(cursor)) throw new ProviderError("INVALID_ARGUMENT", "cursor is invalid for this result set.");
  return { limit: resolvedLimit, offset: Number(cursor) };
}
function nbaStatsDate(value: string | undefined): string {
  return value ? `${value.slice(5, 7)}/${value.slice(8, 10)}/${value.slice(0, 4)}` : "";
}
function gameLogDate(value: unknown): string {
  const source = requiredText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) return source;
  const parsed = Date.parse(source);
  if (!Number.isFinite(parsed)) throw new ProviderError("PROVIDER_UNAVAILABLE", `nba.com returned an invalid game date '${source}'.`);
  return new Date(parsed).toISOString().slice(0, 10);
}
function teamFromAbbreviation(abbreviation: string): Team {
  return canonicalNbaTeam(abbreviation) ?? { id: abbreviation, abbreviation, name: abbreviation };
}
function playerFromStatsProfile(table: StatsTable, row: unknown[], playerId: string): Player {
  const firstName = text(statsValue(table, row, "FIRST_NAME"));
  const lastName = text(statsValue(table, row, "LAST_NAME"));
  const fullName = text(statsValue(table, row, "DISPLAY_FIRST_LAST")) ?? [firstName, lastName].filter(Boolean).join(" ");
  if (!fullName) throw new ProviderError("PROVIDER_UNAVAILABLE", `nba.com did not return a display name for player '${playerId}'.`);
  const teamId = text(statsValue(table, row, "TEAM_ID"));
  const status = text(statsValue(table, row, "ROSTERSTATUS"));
  const position = text(statsValue(table, row, "POSITION"));
  return { id: playerId, fullName, ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}), ...(teamId && teamId !== "0" ? { teamId } : {}), ...(position ? { position } : {}), active: status ? status.toLowerCase() === "active" : true };
}
function gameFromStatsLog(table: StatsTable, row: unknown[]): Game {
  const matchup = requiredText(statsValue(table, row, "MATCHUP"));
  const match = /^([A-Z]{2,3})\s+(vs\.?|@)\s+([A-Z]{2,3})$/.exec(matchup);
  if (!match) throw new ProviderError("PROVIDER_UNAVAILABLE", `nba.com returned an unrecognized player-game matchup '${matchup}'.`);
  const team = teamFromAbbreviation(match[1]!);
  const opponent = teamFromAbbreviation(match[3]!);
  const home = match[2]!.startsWith("vs") ? team : opponent;
  const away = match[2]!.startsWith("vs") ? opponent : team;
  return { gameId: requiredText(statsValue(table, row, "Game_ID")), date: gameLogDate(statsValue(table, row, "GAME_DATE")), status: { state: "final", period: 4, statusText: "Final" }, homeTeam: home, awayTeam: away };
}
function retryDelayMs(value: string | null, now = Date.now()): number {
  const seconds = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value ?? "");
  return Number.isFinite(date) ? Math.max(0, date - now) : DEFAULT_RATE_LIMIT_RETRY_MS;
}
function toStatus(raw: JsonObject): GameStatus {
  const code = requiredNumber(raw.gameStatus);
  const statusText = requiredText(raw.gameStatusText, "");
  const state: GameStatus["state"] = code === 1
    ? "scheduled"
    : code === 2
      ? (statusText.toLocaleLowerCase().includes("halftime") ? "halftime" : "in_progress")
      : code === 3 ? "final" : statusText.toLocaleLowerCase().includes("cancel") ? "cancelled" : "postponed";
  return {
    state,
    period: requiredNumber(raw.period),
    ...(text(raw.gameClock) ? { clock: displayClock(requiredText(raw.gameClock)) } : {}),
    statusText: statusText || state,
    ...(text(raw.gameTimeUTC) ? { startsAt: requiredText(raw.gameTimeUTC) } : {}),
  };
}

function toTeam(rawValue: unknown): Team & { score?: number } {
  const raw = object(rawValue);
  const abbreviation = requiredText(raw.teamTricode, requiredText(raw.teamCode));
  const id = requiredText(raw.teamId, abbreviation);
  const city = text(raw.teamCity);
  const name = [city, text(raw.teamName)].filter(Boolean).join(" ") || abbreviation;
  return { id, abbreviation, name, ...(city ? { city } : {}), ...(number(raw.score) !== undefined ? { score: requiredNumber(raw.score) } : {}) };
}

function toGame(rawValue: unknown): Game {
  const raw = object(rawValue);
  return {
    gameId: requiredText(raw.gameId),
    date: requiredText(raw.gameDateEst, requiredText(raw.gameDate, new Date().toISOString().slice(0, 10))),
    status: toStatus(raw),
    homeTeam: toTeam(raw.homeTeam),
    awayTeam: toTeam(raw.awayTeam),
    ...(text(object(raw.arena).arenaName) ? { venue: requiredText(object(raw.arena).arenaName) } : {}),
  };
}

function stat(raw: JsonObject, key: string): number | undefined { return number(raw[key]); }
function playerFromLive(rawValue: unknown, teamId: string): Player {
  const raw = object(rawValue);
  const firstName = text(raw.firstName);
  const lastName = text(raw.familyName);
  return {
    id: requiredText(raw.personId), fullName: requiredText(raw.name, [firstName, lastName].filter(Boolean).join(" ")),
    ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}), teamId,
    ...(text(raw.position) ? { position: requiredText(raw.position) } : {}), ...(text(raw.jerseyNum) ? { jerseyNumber: requiredText(raw.jerseyNum) } : {}), active: requiredText(raw.status, "ACTIVE").toUpperCase() === "ACTIVE",
  };
}

/** Adapter for public nba.com live JSON and stats endpoints. No API key is required. */
export class NbaComProvider implements DataProvider {
  readonly name = "nba-com";

  constructor(private readonly request: typeof fetch = fetch) {}
  readonly capabilities: ProviderCapabilities = { supportsLiveScores: true, supportsLiveBoxScores: true, supportsPlayByPlay: true, supportsCurrentRosters: true, supportsInjuries: false, supportsHistoricalStats: true, supportsPlayerSeasonStats: true, supportsPlayerGameLogs: true, supportsTeamSeasonStats: true, supportsTeamGameLogs: true, supportsLeagueLeaders: true, supportsHistoricalStandings: false, supportsHistoricalBoxScores: false, supportsHistoricalPlayByPlay: false, updateFrequencySeconds: 10 };

  private async getJson(url: string): Promise<{ data: JsonObject; latencyMs: number }> {
    const started = Date.now();
    let response: Response;
    for (let attempt = 0; ; attempt += 1) {
      try {
        response = await this.request(url, { headers: headersFor(url), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      } catch (error) {
        throw new ProviderError("PROVIDER_UNAVAILABLE", `nba.com request failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (response.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) break;
      await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs(response.headers.get("retry-after"))));
    }

    if (!response.ok) {
      const path = new URL(url).pathname;
      if (response.status === 401) {
        throw new ProviderError("AUTH_REQUIRED", `nba.com requires authentication for ${path}.`);
      }
      if (response.status === 403) {
        throw new ProviderError("PROVIDER_UNAVAILABLE", `nba.com denied access to ${path}.`);
      }
      if (response.status === 429) {
        const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
        throw new ProviderError("PROVIDER_RATE_LIMITED", `nba.com rate-limited the request to ${path}.`, {
          ...(Number.isFinite(retryAfter) ? { retryAfterSeconds: retryAfter } : {}),
        });
      }
      if (response.status === 404) throw new ProviderError("NOT_FOUND", `nba.com did not find ${path}.`);
      throw new ProviderError("PROVIDER_UNAVAILABLE", `nba.com returned HTTP ${response.status} for ${path}.`);
    }

    try {
      return { data: object(await response.json()), latencyMs: Date.now() - started };
    } catch (error) {
      throw new ProviderError("PROVIDER_UNAVAILABLE", `nba.com returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private meta(latencyMs: number, live: boolean): ResponseMetadata { return { source: this.name, lastUpdated: new Date().toISOString(), dataFreshnessSeconds: 0, isLive: live, cacheStatus: "bypass", providerLatencyMs: latencyMs }; }
  private historicalMeta(latencyMs: number, season: string, seasonType: "Regular Season" | "Playoffs", dataset: string): ResponseMetadata {
    return { ...this.meta(latencyMs, false), season, seasonType, dataset, coverage: "unknown", coverageNote: "Historical source coverage is fixture-validated but has not been live-verified." };
  }
  /** The CDN scoreboard is the primary source for the current NBA slate. */
  private async todaysSchedule(): Promise<{ games: Game[]; latencyMs: number }> {
    const response = await this.getJson(`${LIVE_BASE_URL}/scoreboard/todaysScoreboard_00.json`);
    return { games: array(object(response.data.scoreboard).games).map(toGame), latencyMs: response.latencyMs };
  }

  /** The CDN's season schedule is public; core-api's per-day gamecard feed blocks server requests. */
  private async schedule(): Promise<{ gameDates: unknown[]; latencyMs: number }> {
    const response = await this.getJson(SCHEDULE_URL);
    return { gameDates: array(object(response.data.leagueSchedule).gameDates), latencyMs: response.latencyMs };
  }

  private gamesForDate(gameDates: unknown[], date: string): Game[] {
    return gameDates.flatMap((value) => {
      const gameDateEntry = object(value);
      const scheduledDate = scheduleDate(gameDateEntry.gameDate, "");
      if (scheduledDate !== date) return [];
      return array(gameDateEntry.games).map((game) => toGame({ ...object(game), gameDateEst: scheduleDate(object(game).gameDateEst, scheduledDate) }));
    });
  }

  async getLiveGames(): Promise<LiveGamesResponse> {
    const { games, latencyMs } = await this.todaysSchedule();
    const live = games.filter((game): game is LiveGame => isLive(game.status.state) && game.homeTeam.score !== undefined && game.awayTeam.score !== undefined);
    return { games: live, meta: this.meta(latencyMs, true) };
  }

  async getTodaysGames(input: GetTodaysGamesInput = {}): Promise<TodaysGamesResponse> {
    const timezone = input.timezone ?? "America/New_York";
    const date = input.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
    const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
    // The live CDN feed only exposes today. The CDN season schedule serves other dates.
    const result = date === currentDate
      ? await this.todaysSchedule()
      : await this.schedule().then((schedule) => ({ games: this.gamesForDate(schedule.gameDates, date), latencyMs: schedule.latencyMs }));
    return { date, timezone, games: result.games, meta: this.meta(result.latencyMs, result.games.some((game) => isLive(game.status.state))) };
  }

  async getGamesThisWeek(input: GetGamesThisWeekInput = {}): Promise<GamesThisWeekResponse> {
    const timezone = input.timezone ?? "America/New_York";
    const anchorDate = input.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
    const anchor = new Date(`${anchorDate}T12:00:00Z`);
    if (Number.isNaN(anchor.getTime())) throw new ProviderError("DATA_UNAVAILABLE", `Invalid NBA schedule date '${anchorDate}'.`);
    const daysSinceMonday = (anchor.getUTCDay() + 6) % 7;
    anchor.setUTCDate(anchor.getUTCDate() - daysSinceMonday);
    const dates = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(anchor);
      day.setUTCDate(anchor.getUTCDate() + index);
      return day.toISOString().slice(0, 10);
    });
    const schedule = await this.schedule();
    const games = dates.flatMap((date) => this.gamesForDate(schedule.gameDates, date));
    const latencyMs = schedule.latencyMs;
    return {
      startDate: dates[0]!, endDate: dates[6]!, timezone, games,
      meta: this.meta(latencyMs, games.some((game) => isLive(game.status.state))),
    };
  }

  async getGameStatus(gameId: string): Promise<GameStatusResponse> {
    const { games, latencyMs } = await this.todaysSchedule();
    const game = games.find((candidate) => candidate.gameId === gameId);
    if (!game) throw new ProviderError("NOT_FOUND", `Game '${gameId}' was not found on today's nba.com schedule.`);
    return { game, meta: this.meta(latencyMs, isLive(game.status.state)) };
  }

  async getGameBoxScore(gameId: string): Promise<GameBoxScoreResponse> {
    const response = await this.getJson(`${LIVE_BASE_URL}/boxscore/boxscore_${encodeURIComponent(gameId)}.json`);
    const rawGame = object(response.data.game);
    const status = toStatus(rawGame);
    const teams = [object(rawGame.homeTeam), object(rawGame.awayTeam)];
    const teamScores: TeamBoxScore[] = teams.map((raw) => {
      const statistics = object(raw.statistics);
      return { team: toTeam(raw), points: requiredNumber(raw.score), rebounds: requiredNumber(statistics.reboundsTotal), assists: requiredNumber(statistics.assists), ...(stat(statistics, "steals") !== undefined ? { steals: requiredNumber(statistics.steals) } : {}), ...(stat(statistics, "blocks") !== undefined ? { blocks: requiredNumber(statistics.blocks) } : {}), ...(stat(statistics, "turnoversTotal") !== undefined ? { turnovers: requiredNumber(statistics.turnoversTotal) } : {}), ...(stat(statistics, "fieldGoalsMade") !== undefined ? { fieldGoalsMade: requiredNumber(statistics.fieldGoalsMade) } : {}), ...(stat(statistics, "fieldGoalsAttempted") !== undefined ? { fieldGoalsAttempted: requiredNumber(statistics.fieldGoalsAttempted) } : {}), ...(stat(statistics, "threePointersMade") !== undefined ? { threePointersMade: requiredNumber(statistics.threePointersMade) } : {}), ...(stat(statistics, "threePointersAttempted") !== undefined ? { threePointersAttempted: requiredNumber(statistics.threePointersAttempted) } : {}), ...(stat(statistics, "freeThrowsMade") !== undefined ? { freeThrowsMade: requiredNumber(statistics.freeThrowsMade) } : {}), ...(stat(statistics, "freeThrowsAttempted") !== undefined ? { freeThrowsAttempted: requiredNumber(statistics.freeThrowsAttempted) } : {}) };
    });
    const players: PlayerBoxScore[] = teams.flatMap((team) => array(team.players).map((rawValue) => {
      const raw = object(rawValue); const statistics = object(raw.statistics); const teamId = requiredText(team.teamId);
      return { player: playerFromLive(raw, teamId), teamId, starter: raw.starter === true, played: raw.played === true, ...(text(statistics.minutes) ? { minutes: displayClock(requiredText(statistics.minutes)) } : {}), points: requiredNumber(statistics.points), rebounds: requiredNumber(statistics.reboundsTotal), assists: requiredNumber(statistics.assists), ...(stat(statistics, "steals") !== undefined ? { steals: requiredNumber(statistics.steals) } : {}), ...(stat(statistics, "blocks") !== undefined ? { blocks: requiredNumber(statistics.blocks) } : {}), ...(stat(statistics, "turnovers") !== undefined ? { turnovers: requiredNumber(statistics.turnovers) } : {}), ...(stat(statistics, "plusMinusPoints") !== undefined ? { plusMinus: requiredNumber(statistics.plusMinusPoints) } : {}) };
    }));
    const boxScore: BoxScore = { gameId, status, teams: teamScores, players };
    return { boxScore, meta: this.meta(response.latencyMs, isLive(status.state)) };
  }

  async getRecentGameEvents(input: GetRecentGameEventsInput): Promise<RecentGameEventsResponse> {
    const response = await this.getJson(`${LIVE_BASE_URL}/playbyplay/playbyplay_${encodeURIComponent(input.gameId)}.json`);
    const actions = array(object(response.data.game).actions).slice(-(input.limit ?? 10)).reverse();
    const events: PlayByPlayEvent[] = actions.map((value) => { const raw = object(value); return { eventId: String(raw.actionNumber ?? raw.actionId ?? ""), gameId: input.gameId, period: requiredNumber(raw.period), ...(text(raw.clock) ? { clock: displayClock(requiredText(raw.clock)) } : {}), ...(number(raw.orderNumber) !== undefined ? { sequenceNumber: requiredNumber(raw.orderNumber) } : {}), ...(text(raw.teamId) ? { teamId: requiredText(raw.teamId) } : {}), ...(text(raw.personId) ? { playerId: requiredText(raw.personId) } : {}), eventType: requiredText(raw.actionType, "event"), description: requiredText(raw.description, requiredText(raw.actionType, "NBA game event")), ...(number(raw.scoreHome) !== undefined ? { scoreHome: requiredNumber(raw.scoreHome) } : {}), ...(number(raw.scoreAway) !== undefined ? { scoreAway: requiredNumber(raw.scoreAway) } : {}), ...(text(raw.timeActual) ? { occurredAt: requiredText(raw.timeActual) } : {}) }; });
    return { gameId: input.gameId, events, meta: this.meta(response.latencyMs, true) };
  }

  private teamNumericId(teamId: string): string { return nbaTeam(teamId)?.numericId ?? teamId; }
  async getTeamRoster(teamId: string): Promise<TeamRosterResponse> {
    const canonicalTeam = canonicalNbaTeam(teamId);
    if (!canonicalTeam) throw new ProviderError("NOT_FOUND", `NBA team '${teamId}' was not found.`);
    const response = await this.getJson(`${STATS_BASE_URL}/commonteamroster?LeagueID=00&Season=${encodeURIComponent(this.currentSeason())}&TeamID=${encodeURIComponent(canonicalTeam.id)}`);
    const resultSets = array(response.data.resultSets); const rosterSet = object(resultSets[0]); const headers = array(rosterSet.headers).map(String); const rows = array(rosterSet.rowSet);
    const at = (row: unknown[], name: string): unknown => row[headers.indexOf(name)];
    const players: Player[] = rows.map(array).map((row) => {
      const position = text(at(row, "POSITION"));
      const jerseyNumber = text(at(row, "NUM"));
      return { id: String(at(row, "PLAYER_ID") ?? ""), fullName: requiredText(at(row, "PLAYER")), teamId: this.teamNumericId(teamId), active: true, ...(position ? { position } : {}), ...(jerseyNumber ? { jerseyNumber } : {}) };
    });
    const team: Team = canonicalTeam;
    const roster: Roster = { team, players, season: this.currentSeason() };
    return { roster, meta: this.meta(response.latencyMs, false) };
  }

  async searchTeams(query: string): Promise<SearchTeamsResponse> {
    return { query, teams: searchNbaTeams(query), meta: this.meta(0, false) };
  }

  async searchPlayers(_input: SearchPlayersInput): Promise<SearchPlayersResponse> {
    throw new ProviderError("DATA_UNAVAILABLE", "nba.com player search is unavailable until an authoritative current-player directory is configured; search a team's roster instead.", {
      suggestedAlternatives: ["Use search_teams", "Use get_team_roster"],
    });
  }
  private historicalUnavailable(): never {
    throw new ProviderError("UNSUPPORTED_CAPABILITY", "Historical NBA data has not been validated for the nba.com provider.");
  }
  async getPlayerSeasonStats(input: GetPlayerSeasonStatsInput): Promise<PlayerSeasonStatsResponse> {
    const { playerId, season, seasonType, perMode } = historicalPlayerInput(input);
    const dashboardUrl = statsUrl("playerdashboardbygeneralsplits", {
      DateFrom: "", DateTo: "", GameSegment: "", LastNGames: "0", LeagueID: "00", Location: "", MeasureType: "Base", Month: "0", OpponentTeamID: "0", Outcome: "", PORound: "0", PaceAdjust: "N", PerMode: perMode, Period: "0", PlayerID: playerId, PlusMinus: "N", Rank: "N", Season: season, SeasonSegment: "", SeasonType: seasonType, ShotClockRange: "", VsConference: "", VsDivision: "",
    });
    const profileUrl = statsUrl("commonplayerinfo", { LeagueID: "00", PlayerID: playerId });
    const [dashboard, profile] = await Promise.all([this.getJson(dashboardUrl), this.getJson(profileUrl)]);
    const overall = statsTable(dashboard.data, "OverallPlayerDashboard");
    const profileTable = statsTable(profile.data, "CommonPlayerInfo");
    const overallRow = overall.rows[0];
    const profileRow = profileTable.rows[0];
    if (!overallRow) throw new ProviderError("DATA_UNAVAILABLE", `nba.com has no ${season} ${seasonType.toLowerCase()} aggregate for player '${playerId}'.`);
    if (!profileRow) throw new ProviderError("NOT_FOUND", `nba.com did not return player '${playerId}'.`);
    const player = playerFromStatsProfile(profileTable, profileRow, playerId);
    return {
      playerSeasonStats: { player, season, seasonType, perMode, stats: traditionalStats(overall, overallRow) },
      meta: this.historicalMeta(Math.max(dashboard.latencyMs, profile.latencyMs), season, seasonType, "stats.nba.com/playerdashboardbygeneralsplits"),
    };
  }
  async getPlayerGameLog(input: GetPlayerGameLogInput): Promise<PlayerGameLogResponse> {
    const { playerId, season, seasonType } = historicalPlayerInput(input);
    const dateFrom = isoDate(input.dateFrom, "dateFrom");
    const dateTo = isoDate(input.dateTo, "dateTo");
    if (dateFrom && dateTo && dateFrom > dateTo) throw new ProviderError("INVALID_ARGUMENT", "dateFrom must not be after dateTo.");
    const { limit, offset } = pageInput(input.limit, input.cursor);
    const gameLogUrl = statsUrl("playergamelog", { DateFrom: nbaStatsDate(dateFrom), DateTo: nbaStatsDate(dateTo), LeagueID: "00", PlayerID: playerId, Season: season, SeasonType: seasonType });
    const profileUrl = statsUrl("commonplayerinfo", { LeagueID: "00", PlayerID: playerId });
    const [gameLog, profile] = await Promise.all([this.getJson(gameLogUrl), this.getJson(profileUrl)]);
    const log = statsTable(gameLog.data, "PlayerGameLog");
    const profileTable = statsTable(profile.data, "CommonPlayerInfo");
    const profileRow = profileTable.rows[0];
    if (!profileRow) throw new ProviderError("NOT_FOUND", `nba.com did not return player '${playerId}'.`);
    const player = playerFromStatsProfile(profileTable, profileRow, playerId);
    const games = log.rows
      .map((row) => ({ player, game: gameFromStatsLog(log, row), matchup: requiredText(statsValue(log, row, "MATCHUP")), ...(text(statsValue(log, row, "WL")) ? { result: requiredText(statsValue(log, row, "WL")) as "W" | "L" } : {}), stats: traditionalStats(log, row) }))
      .filter((entry) => (!dateFrom || entry.game.date >= dateFrom) && (!dateTo || entry.game.date <= dateTo));
    const items = games.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    const hasMore = nextOffset < games.length;
    return { player, season, seasonType, games: items, page: { limit, hasMore, isBoundedResult: hasMore, ...(hasMore ? { nextCursor: String(nextOffset) } : {}) }, meta: this.historicalMeta(Math.max(gameLog.latencyMs, profile.latencyMs), season, seasonType, "stats.nba.com/playergamelog") };
  }
  async getTeamSeasonStats(input: GetTeamSeasonStatsInput): Promise<TeamSeasonStatsResponse> {
    const { team, season, seasonType, perMode } = historicalTeamInput(input);
    const url = statsUrl("teamdashboardbygeneralsplits", {
      DateFrom: "", DateTo: "", GameSegment: "", LastNGames: "0", LeagueID: "00", Location: "", MeasureType: "Base", Month: "0", OpponentTeamID: "0", Outcome: "", PORound: "0", PaceAdjust: "N", PerMode: perMode, Period: "0", PlusMinus: "N", Rank: "N", Season: season, SeasonSegment: "", SeasonType: seasonType, ShotClockRange: "", TeamID: team.id, VsConference: "", VsDivision: "",
    });
    const response = await this.getJson(url);
    const overall = statsTable(response.data, "OverallTeamDashboard");
    const row = overall.rows[0];
    if (!row) throw new ProviderError("DATA_UNAVAILABLE", `nba.com has no ${season} ${seasonType.toLowerCase()} aggregate for team '${team.id}'.`);
    return {
      teamSeasonStats: { team, season, seasonType, perMode, stats: traditionalStats(overall, row) },
      meta: this.historicalMeta(response.latencyMs, season, seasonType, "stats.nba.com/teamdashboardbygeneralsplits"),
    };
  }
  async getTeamGameLog(input: GetTeamGameLogInput): Promise<TeamGameLogResponse> {
    const { team, season, seasonType } = historicalTeamInput(input);
    const dateFrom = isoDate(input.dateFrom, "dateFrom");
    const dateTo = isoDate(input.dateTo, "dateTo");
    if (dateFrom && dateTo && dateFrom > dateTo) throw new ProviderError("INVALID_ARGUMENT", "dateFrom must not be after dateTo.");
    const { limit, offset } = pageInput(input.limit, input.cursor);
    const url = statsUrl("teamgamelog", { DateFrom: nbaStatsDate(dateFrom), DateTo: nbaStatsDate(dateTo), LeagueID: "00", Season: season, SeasonType: seasonType, TeamID: team.id });
    const response = await this.getJson(url);
    const log = statsTable(response.data, "TeamGameLog");
    const games = log.rows
      .map((row) => ({ team, game: gameFromStatsLog(log, row), matchup: requiredText(statsValue(log, row, "MATCHUP")), ...(text(statsValue(log, row, "WL")) ? { result: requiredText(statsValue(log, row, "WL")) as "W" | "L" } : {}), stats: traditionalStats(log, row) }))
      .filter((entry) => (!dateFrom || entry.game.date >= dateFrom) && (!dateTo || entry.game.date <= dateTo));
    const items = games.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    const hasMore = nextOffset < games.length;
    return { team, season, seasonType, games: items, page: { limit, hasMore, isBoundedResult: hasMore, ...(hasMore ? { nextCursor: String(nextOffset) } : {}) }, meta: this.historicalMeta(response.latencyMs, season, seasonType, "stats.nba.com/teamgamelog") };
  }
  async getLeagueLeaders(input: GetLeagueLeadersInput): Promise<LeagueLeadersResponse> {
    const { season, seasonType, perMode, statCategory, limit, offset } = historicalLeagueLeadersInput(input);
    const response = await this.getJson(statsUrl("leagueleaders", { LeagueID: "00", PerMode: perMode, Scope: "S", Season: season, SeasonType: seasonType, StatCategory: statCategory }));
    const leadersTable = statsTable(response.data, "LeagueLeaders");
    const leaders: LeagueLeader[] = leadersTable.rows.map((row) => {
      const playerId = requiredText(statsValue(leadersTable, row, "PLAYER_ID"));
      const fullName = requiredText(statsValue(leadersTable, row, "PLAYER"));
      const teamId = text(statsValue(leadersTable, row, "TEAM_ID"));
      const abbreviation = text(statsValue(leadersTable, row, "TEAM"));
      const team = abbreviation ? teamFromAbbreviation(abbreviation) : undefined;
      return {
        scope: "player", rank: requiredNumber(statsValue(leadersTable, row, "RANK")), player: { id: playerId, fullName, active: true, ...(teamId ? { teamId } : {}) }, ...(team ? { team } : {}),
        statCategory, value: requiredNumber(statsValue(leadersTable, row, statCategory)), season, seasonType, perMode,
      };
    });
    const items = leaders.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    const hasMore = nextOffset < leaders.length;
    return { season, seasonType, perMode, statCategory, leaders: items, page: { limit, hasMore, isBoundedResult: hasMore, ...(hasMore ? { nextCursor: String(nextOffset) } : {}) }, meta: this.historicalMeta(response.latencyMs, season, seasonType, "stats.nba.com/leagueleaders") };
  }
  async getLeagueStandings(_input: GetLeagueStandingsInput) { return this.historicalUnavailable(); }
  async getHistoricalGameBoxScore(_gameId: string) { return this.historicalUnavailable(); }
  async getHistoricalGameEvents(_input: GetHistoricalGameEventsInput) { return this.historicalUnavailable(); }
  async getCapabilities(): Promise<ProviderCapabilities> { return this.capabilities; }
  private currentSeason(): string { const now = new Date(); const year = now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0); return `${year}-${String((year + 1) % 100).padStart(2, "0")}`; }
}
