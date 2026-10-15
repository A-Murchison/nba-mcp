import type { ProviderCapabilities } from "../domain/capabilities.js";
import type {
  BoxScore, Game, GameBoxScoreResponse, GameStatus, GameStatusResponse, LiveGame, LiveGamesResponse,
  Player, PlayerBoxScore, PlayByPlayEvent, RecentGameEventsResponse, ResponseMetadata, Roster,
  SearchPlayersResponse, SearchTeamsResponse, Team, TeamBoxScore, TeamRosterResponse, TodaysGamesResponse,
} from "../domain/models.js";
import type { DataProvider, GetRecentGameEventsInput, GetTodaysGamesInput, SearchPlayersInput } from "./DataProvider.js";
import { ProviderError } from "./ProviderError.js";
import { canonicalNbaTeam, nbaTeam, searchNbaTeams } from "./nbaTeams.js";

type JsonObject = Record<string, unknown>;

const LIVE_BASE_URL = "https://cdn.nba.com/static/json/liveData";
const STATS_BASE_URL = "https://stats.nba.com/stats";
const NBA_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nba.com",
  Referer: "https://www.nba.com/",
  "User-Agent": "Mozilla/5.0 (compatible; nba-mcp/0.1; +https://github.com)",
};

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
function isLive(state: GameStatus["state"]): boolean { return state === "in_progress" || state === "halftime"; }
function displayClock(value: string): string {
  const match = /^PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value);
  if (!match) return value;
  return `${match[1] ?? "0"}:${Math.floor(Number(match[2] ?? 0)).toString().padStart(2, "0")}`;
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
  readonly capabilities: ProviderCapabilities = { supportsLiveScores: true, supportsLiveBoxScores: true, supportsPlayByPlay: true, supportsCurrentRosters: true, supportsInjuries: false, supportsHistoricalStats: false, updateFrequencySeconds: 10 };

  private async getJson(url: string): Promise<{ data: JsonObject; latencyMs: number }> {
    const started = Date.now();
    let response: Response;
    try {
      response = await this.request(url, { headers: NBA_HEADERS, signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      throw new ProviderError("PROVIDER_UNAVAILABLE", `nba.com request failed: ${error instanceof Error ? error.message : String(error)}`);
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
  private async scoreboard(): Promise<{ games: Game[]; latencyMs: number }> {
    const response = await this.getJson(`${LIVE_BASE_URL}/scoreboard/todaysScoreboard_00.json`);
    return { games: array(object(response.data.scoreboard).games).map(toGame), latencyMs: response.latencyMs };
  }

  async getLiveGames(): Promise<LiveGamesResponse> {
    const { games, latencyMs } = await this.scoreboard();
    const live = games.filter((game): game is LiveGame => isLive(game.status.state) && game.homeTeam.score !== undefined && game.awayTeam.score !== undefined);
    return { games: live, meta: this.meta(latencyMs, true) };
  }

  async getTodaysGames(input: GetTodaysGamesInput = {}): Promise<TodaysGamesResponse> {
    const { games, latencyMs } = await this.scoreboard();
    const date = input.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: input.timezone ?? "America/New_York" }).format(new Date());
    // The live endpoint only supplies today's US slate; don't silently claim it supports arbitrary dates.
    if (input.date && games.length > 0 && !games.some((game) => game.date === input.date)) {
      throw new ProviderError("DATA_UNAVAILABLE", "nba.com live scoreboard only supports the current day's schedule.", {
        suggestedAlternatives: ["Omit date to retrieve today's games"],
      });
    }
    return { date, timezone: input.timezone ?? "America/New_York", games, meta: this.meta(latencyMs, games.some((game) => isLive(game.status.state))) };
  }

  async getGameStatus(gameId: string): Promise<GameStatusResponse> {
    const { games, latencyMs } = await this.scoreboard();
    const game = games.find((candidate) => candidate.gameId === gameId);
    if (!game) throw new ProviderError("NOT_FOUND", `Game '${gameId}' was not found on today's nba.com scoreboard.`);
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
  async getCapabilities(): Promise<ProviderCapabilities> { return this.capabilities; }
  private currentSeason(): string { const now = new Date(); const year = now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0); return `${year}-${String((year + 1) % 100).padStart(2, "0")}`; }
}
