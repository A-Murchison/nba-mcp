import type { ProviderCapabilities } from "../../domain/capabilities.js";
import type {
  BoxScore,
  Game,
  HistoricalGameBoxScoreResponse,
  HistoricalGameEventsResponse,
  HistoricalGameLogEntry,
  LeagueLeadersResponse,
  LeagueStandingsResponse,
  TraditionalStats,
  GameBoxScoreResponse,
  GamesThisWeekResponse,
  GameStatusResponse,
  LiveGame,
  LiveGamesResponse,
  Player,
  PlayByPlayEvent,
  RecentGameEventsResponse,
  ResponseMetadata,
  SearchPlayersResponse,
  SearchTeamsResponse,
  Team,
  TeamRosterResponse,
  TodaysGamesResponse,
} from "../../domain/models.js";
import type {
  DataProvider,
  GetGamesThisWeekInput,
  GetHistoricalGameEventsInput,
  GetLeagueLeadersInput,
  GetLeagueStandingsInput,
  GetPlayerGameLogInput,
  GetPlayerSeasonStatsInput,
  GetRecentGameEventsInput,
  GetTeamGameLogInput,
  GetTeamSeasonStatsInput,
  GetTodaysGamesInput,
  SearchPlayersInput,
} from "../DataProvider.js";
import { ProviderError } from "../ProviderError.js";

const generatedAt = new Date().toISOString();

const teams: Team[] = [
  {
    id: "BOS",
    abbreviation: "BOS",
    name: "Boston Celtics",
    city: "Boston",
    conference: "Eastern",
    division: "Atlantic",
  },
  {
    id: "DEN",
    abbreviation: "DEN",
    name: "Denver Nuggets",
    city: "Denver",
    conference: "Western",
    division: "Northwest",
  },
  {
    id: "LAL",
    abbreviation: "LAL",
    name: "Los Angeles Lakers",
    city: "Los Angeles",
    conference: "Western",
    division: "Pacific",
  },
  {
    id: "GSW",
    abbreviation: "GSW",
    name: "Golden State Warriors",
    city: "San Francisco",
    conference: "Western",
    division: "Pacific",
  },
  {
    id: "CHI",
    abbreviation: "CHI",
    name: "Chicago Bulls",
    city: "Chicago",
    conference: "Eastern",
    division: "Central",
  },
];

const players: Player[] = [
  { id: "mock-tatum", fullName: "Jayson Tatum", firstName: "Jayson", lastName: "Tatum", teamId: "BOS", position: "F", jerseyNumber: "0", active: true, height: "6-8", weight: "210" },
  { id: "mock-brown", fullName: "Jaylen Brown", firstName: "Jaylen", lastName: "Brown", teamId: "BOS", position: "G-F", jerseyNumber: "7", active: true, height: "6-6", weight: "223" },
  { id: "mock-jokic", fullName: "Nikola Jokic", firstName: "Nikola", lastName: "Jokic", teamId: "DEN", position: "C", jerseyNumber: "15", active: true, height: "6-11", weight: "284" },
  { id: "mock-murray", fullName: "Jamal Murray", firstName: "Jamal", lastName: "Murray", teamId: "DEN", position: "G", jerseyNumber: "27", active: true, height: "6-4", weight: "215" },
  { id: "mock-lebron", fullName: "LeBron James", firstName: "LeBron", lastName: "James", teamId: "LAL", position: "F", jerseyNumber: "23", active: true, height: "6-9", weight: "250" },
  { id: "mock-curry", fullName: "Stephen Curry", firstName: "Stephen", lastName: "Curry", teamId: "GSW", position: "G", jerseyNumber: "30", active: true, height: "6-2", weight: "185" },
  { id: "mock-jordan", fullName: "Michael Jordan", firstName: "Michael", lastName: "Jordan", teamId: "CHI", position: "G", jerseyNumber: "23", active: false },
];

const liveGame: LiveGame = {
  gameId: "mock-live-001",
  date: "2026-01-12",
  venue: "TD Garden",
  status: {
    state: "in_progress",
    period: 3,
    clock: "04:18",
    statusText: "Q3 04:18",
    possessionTeamId: "BOS",
  },
  homeTeam: { ...teams[0]!, score: 82 },
  awayTeam: { ...teams[1]!, score: 78 },
};

const scheduledGame: Game = {
  gameId: "mock-scheduled-001",
  date: "2026-01-12",
  venue: "Crypto.com Arena",
  status: {
    state: "scheduled",
    period: 0,
    statusText: "Scheduled 10:00 PM ET",
    startsAt: "2026-01-13T03:00:00Z",
  },
  homeTeam: teams[2]!,
  awayTeam: teams[3]!,
};

const finalGame: Game = {
  gameId: "mock-final-001",
  date: "2026-01-12",
  venue: "Chase Center",
  status: {
    state: "final",
    period: 4,
    statusText: "Final",
  },
  homeTeam: { ...teams[3]!, score: 111 },
  awayTeam: { ...teams[2]!, score: 104 },
};

const boxScore: BoxScore = {
  gameId: liveGame.gameId,
  status: liveGame.status,
  teams: [
    { team: teams[0]!, points: 82, rebounds: 32, assists: 21, steals: 5, blocks: 4, turnovers: 8, fieldGoalsMade: 31, fieldGoalsAttempted: 67, threePointersMade: 11, threePointersAttempted: 29, freeThrowsMade: 9, freeThrowsAttempted: 12 },
    { team: teams[1]!, points: 78, rebounds: 35, assists: 20, steals: 4, blocks: 3, turnovers: 10, fieldGoalsMade: 30, fieldGoalsAttempted: 66, threePointersMade: 8, threePointersAttempted: 25, freeThrowsMade: 10, freeThrowsAttempted: 14 },
  ],
  players: [
    { player: players[0]!, teamId: "BOS", starter: true, played: true, minutes: "27:34", points: 24, rebounds: 7, assists: 4, steals: 1, blocks: 1, turnovers: 2, fieldGoalsMade: 9, fieldGoalsAttempted: 17, threePointersMade: 3, threePointersAttempted: 8, freeThrowsMade: 3, freeThrowsAttempted: 4, plusMinus: 8 },
    { player: players[1]!, teamId: "BOS", starter: true, played: true, minutes: "25:11", points: 18, rebounds: 4, assists: 3, steals: 2, turnovers: 1, fieldGoalsMade: 7, fieldGoalsAttempted: 13, threePointersMade: 2, threePointersAttempted: 5, freeThrowsMade: 2, freeThrowsAttempted: 2, plusMinus: 5 },
    { player: players[2]!, teamId: "DEN", starter: true, played: true, minutes: "29:02", points: 22, rebounds: 12, assists: 8, steals: 1, blocks: 1, turnovers: 3, fieldGoalsMade: 10, fieldGoalsAttempted: 16, threePointersMade: 1, threePointersAttempted: 3, freeThrowsMade: 1, freeThrowsAttempted: 2, plusMinus: -3 },
    { player: players[3]!, teamId: "DEN", starter: true, played: true, minutes: "26:48", points: 19, rebounds: 3, assists: 5, turnovers: 2, fieldGoalsMade: 7, fieldGoalsAttempted: 15, threePointersMade: 3, threePointersAttempted: 7, freeThrowsMade: 2, freeThrowsAttempted: 2, plusMinus: -6 },
  ],
};

const events: PlayByPlayEvent[] = [
  { eventId: "mock-event-003", gameId: liveGame.gameId, period: 3, clock: "04:18", sequenceNumber: 3, teamId: "BOS", playerId: "mock-tatum", eventType: "made_shot", description: "Jayson Tatum makes 3-foot driving layup", scoreHome: 82, scoreAway: 78, occurredAt: generatedAt },
  { eventId: "mock-event-002", gameId: liveGame.gameId, period: 3, clock: "04:45", sequenceNumber: 2, teamId: "DEN", playerId: "mock-jokic", eventType: "rebound", description: "Nikola Jokic defensive rebound", scoreHome: 80, scoreAway: 78, occurredAt: generatedAt },
  { eventId: "mock-event-001", gameId: liveGame.gameId, period: 3, clock: "05:02", sequenceNumber: 1, teamId: "DEN", playerId: "mock-murray", eventType: "made_shot", description: "Jamal Murray makes 26-foot three point jumper", scoreHome: 80, scoreAway: 78, occurredAt: generatedAt },
];

const historicalBoxScore: BoxScore = {
  gameId: finalGame.gameId,
  status: finalGame.status,
  teams: [
    { team: teams[3]!, points: 111, rebounds: 44, assists: 29, steals: 7, blocks: 5, turnovers: 12 },
    { team: teams[2]!, points: 104, rebounds: 42, assists: 24, steals: 6, blocks: 4, turnovers: 11 },
  ],
  players: [
    { player: players[5]!, teamId: "GSW", starter: true, played: true, minutes: "36:12", points: 34, rebounds: 5, assists: 9, steals: 2, turnovers: 3 },
    { player: players[4]!, teamId: "LAL", starter: true, played: true, minutes: "37:04", points: 31, rebounds: 8, assists: 7, steals: 1, turnovers: 4 },
  ],
};

const historicalEvents: PlayByPlayEvent[] = [
  { eventId: "mock-historical-event-001", gameId: finalGame.gameId, period: 4, clock: "01:02", sequenceNumber: 1, teamId: "GSW", playerId: "mock-curry", eventType: "made_shot", description: "Stephen Curry makes 26-foot three point jumper", scoreHome: 109, scoreAway: 102, occurredAt: generatedAt },
  { eventId: "mock-historical-event-002", gameId: finalGame.gameId, period: 4, clock: "00:18", sequenceNumber: 2, teamId: "LAL", playerId: "mock-lebron", eventType: "made_shot", description: "LeBron James makes 2-foot layup", scoreHome: 111, scoreAway: 104, occurredAt: generatedAt },
];

function metadata(source: string, isLive: boolean): ResponseMetadata {
  const nowMs = Date.now();
  const lastUpdatedMs = Date.parse(generatedAt);

  return {
    source,
    lastUpdated: generatedAt,
    dataFreshnessSeconds: Math.max(0, Math.floor((nowMs - lastUpdatedMs) / 1000)),
    isLive,
    cacheStatus: "bypass",
    providerLatencyMs: 0,
  };
}

function includesQuery(value: string, query: string): boolean {
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function historicalMetadata(source: string, season: string, seasonType: "Regular Season" | "Playoffs", dataset: string): ResponseMetadata {
  return { ...metadata(source, false), season, seasonType, dataset, coverage: "complete" };
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function validateHistoricalInput(season: string, seasonType = "Regular Season", dateFrom?: string, dateTo?: string, perMode?: string): void {
  if (perMode !== undefined && perMode !== "PerGame" && perMode !== "Totals") throw new ProviderError("INVALID_ARGUMENT", "perMode must be PerGame or Totals.");
  const seasonMatch = /^(\d{4})-(\d{2})$/.exec(season);
  if (!seasonMatch || Number(seasonMatch[2]) !== (Number(seasonMatch[1]) + 1) % 100) throw new ProviderError("INVALID_ARGUMENT", "season must use consecutive YYYY-YY years.");
  if (seasonType !== "Regular Season" && seasonType !== "Playoffs") throw new ProviderError("INVALID_ARGUMENT", "seasonType must be Regular Season or Playoffs.");
  if ((dateFrom && !isValidIsoDate(dateFrom)) || (dateTo && !isValidIsoDate(dateTo))) throw new ProviderError("INVALID_ARGUMENT", "dateFrom and dateTo must use valid YYYY-MM-DD dates.");
  if (dateFrom && dateTo && dateFrom > dateTo) throw new ProviderError("INVALID_ARGUMENT", "dateFrom must not be after dateTo.");
}

function page<T>(items: T[], limit = 100, cursor?: string): { items: T[]; limit: number; nextCursor?: string; hasMore: boolean; isBoundedResult: boolean } {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ProviderError("INVALID_ARGUMENT", "limit must be an integer from 1 through 100.");
  const start = cursor === undefined ? 0 : Number.parseInt(cursor, 10);
  if (!Number.isInteger(start) || start < 0 || (cursor !== undefined && String(start) !== cursor)) throw new ProviderError("INVALID_ARGUMENT", "cursor is invalid for this result set.");
  const result = items.slice(start, start + limit);
  const next = start + result.length;
  const hasMore = next < items.length;
  return { items: result, limit, ...(hasMore ? { nextCursor: String(next) } : {}), hasMore, isBoundedResult: hasMore };
}

/**
 * Mock provider returning normalized canonical data.
 *
 * The data is intentionally small and hand-authored so the repository can run
 * without API keys or proprietary NBA data dumps.
 */
export class MockProvider implements DataProvider {
  readonly name = "mock";

  readonly capabilities: ProviderCapabilities = {
    supportsLiveScores: true,
    supportsLiveBoxScores: true,
    supportsPlayByPlay: true,
    supportsCurrentRosters: true,
    supportsInjuries: false,
    supportsHistoricalStats: true,
    supportsPlayerSeasonStats: true,
    supportsPlayerGameLogs: true,
    supportsTeamSeasonStats: true,
    supportsTeamGameLogs: true,
    supportsLeagueLeaders: true,
    supportsHistoricalStandings: true,
    supportsHistoricalBoxScores: true,
    supportsHistoricalPlayByPlay: true,
    updateFrequencySeconds: 10,
  };

  async getLiveGames(): Promise<LiveGamesResponse> {
    return { games: [liveGame], meta: metadata(this.name, true) };
  }

  async getTodaysGames(input: GetTodaysGamesInput = {}): Promise<TodaysGamesResponse> {
    return {
      date: input.date ?? liveGame.date,
      timezone: input.timezone ?? "America/New_York",
      games: [liveGame, scheduledGame, finalGame],
      meta: metadata(this.name, true),
    };
  }

  async getGamesThisWeek(input: GetGamesThisWeekInput = {}): Promise<GamesThisWeekResponse> {
    const timezone = input.timezone ?? "America/New_York";
    const anchorDate = input.date ?? liveGame.date;
    const anchor = new Date(`${anchorDate}T12:00:00Z`);
    const daysSinceMonday = (anchor.getUTCDay() + 6) % 7;
    anchor.setUTCDate(anchor.getUTCDate() - daysSinceMonday);
    const startDate = anchor.toISOString().slice(0, 10);
    anchor.setUTCDate(anchor.getUTCDate() + 6);
    return { startDate, endDate: anchor.toISOString().slice(0, 10), timezone, games: [liveGame, scheduledGame, finalGame], meta: metadata(this.name, true) };
  }

  async getGameStatus(gameId: string): Promise<GameStatusResponse> {
    const game = [liveGame, scheduledGame, finalGame].find((candidate) => candidate.gameId === gameId);
    if (!game) throw new ProviderError("NOT_FOUND", `Game '${gameId}' was not found in mock data.`);
    return { game, meta: metadata(this.name, game.status.state === "in_progress" || game.status.state === "halftime") };
  }

  async getGameBoxScore(gameId: string): Promise<GameBoxScoreResponse> {
    if (![liveGame, scheduledGame, finalGame].some((game) => game.gameId === gameId)) {
      throw new ProviderError("NOT_FOUND", `Game '${gameId}' was not found in mock data.`);
    }
    if (gameId !== boxScore.gameId) {
      throw new ProviderError("DATA_UNAVAILABLE", `A box score is not available for mock game '${gameId}'.`, {
        suggestedAlternatives: ["Use get_game_status", "Use get_todays_games"],
      });
    }
    return { boxScore, meta: metadata(this.name, true) };
  }

  async getRecentGameEvents(input: GetRecentGameEventsInput): Promise<RecentGameEventsResponse> {
    if (![liveGame, scheduledGame, finalGame].some((game) => game.gameId === input.gameId)) {
      throw new ProviderError("NOT_FOUND", `Game '${input.gameId}' was not found in mock data.`);
    }
    if (input.gameId !== liveGame.gameId) {
      throw new ProviderError("DATA_UNAVAILABLE", `Play-by-play is not available for mock game '${input.gameId}'.`, {
        suggestedAlternatives: ["Use get_game_status", "Use get_todays_games"],
      });
    }
    return {
      gameId: input.gameId,
      events: events.slice(0, input.limit ?? 10),
      meta: metadata(this.name, true),
    };
  }

  async getTeamRoster(teamId: string): Promise<TeamRosterResponse> {
    const team = teams.find((candidate) => candidate.id === teamId);
    if (!team) throw new ProviderError("NOT_FOUND", `Team '${teamId}' was not found in mock data.`);
    return {
      roster: {
        team,
        players: players.filter((player) => player.teamId === team.id),
        season: "2025-26",
      },
      meta: metadata(this.name, false),
    };
  }

  async searchTeams(query: string): Promise<SearchTeamsResponse> {
    return {
      query,
      teams: teams.filter((team) =>
        [team.id, team.abbreviation, team.name, team.city ?? ""].some((value) => includesQuery(value, query)),
      ),
      meta: metadata(this.name, false),
    };
  }

  async searchPlayers(input: SearchPlayersInput): Promise<SearchPlayersResponse> {
    const limit = input.limit ?? 10;
    return {
      query: input.query,
      players: players
        .filter((player) => (input.activeOnly === false ? true : player.active))
        .filter((player) => includesQuery(player.fullName, input.query))
        .slice(0, limit),
      meta: metadata(this.name, false),
    };
  }

  async getPlayerSeasonStats(input: GetPlayerSeasonStatsInput) {
    validateHistoricalInput(input.season, input.seasonType, undefined, undefined, input.perMode);
    const player = players.find((candidate) => candidate.id === input.playerId);
    if (!player) throw new ProviderError("NOT_FOUND", `Player '${input.playerId}' was not found in mock data.`);
    if (player.id !== "mock-jordan" || !["1990-91", "1991-92"].includes(input.season)) throw new ProviderError("DATA_UNAVAILABLE", `Mock historical coverage does not include ${input.season} for '${input.playerId}'.`);
    const seasonType = input.seasonType ?? "Regular Season";
    const perMode = input.perMode ?? "PerGame";
    const stats: TraditionalStats = seasonType === "Playoffs"
      ? { gamesPlayed: 17, minutes: perMode === "Totals" ? 689 : 40.5, points: perMode === "Totals" ? 529 : 31.1, rebounds: perMode === "Totals" ? 112 : 6.6, assists: perMode === "Totals" ? 94 : 5.5 }
      : { gamesPlayed: 82, minutes: perMode === "Totals" ? 3_033 : 37.0, points: perMode === "Totals" ? 2_580 : 31.5, rebounds: perMode === "Totals" ? 539 : 6.6, assists: perMode === "Totals" ? 453 : 5.5 };
    return { playerSeasonStats: { player, season: input.season, seasonType, perMode, stats }, meta: historicalMetadata(this.name, input.season, seasonType, "mock.player-season") };
  }

  async getPlayerGameLog(input: GetPlayerGameLogInput) {
    validateHistoricalInput(input.season, input.seasonType, input.dateFrom, input.dateTo);
    const player = players.find((candidate) => candidate.id === input.playerId);
    if (!player) throw new ProviderError("NOT_FOUND", `Player '${input.playerId}' was not found in mock data.`);
    const seasonType = input.seasonType ?? "Regular Season";
    if (player.id !== "mock-jordan" || input.season !== "1990-91") return { player, season: input.season, seasonType, games: [], page: { limit: input.limit ?? 100, hasMore: false, isBoundedResult: false }, meta: historicalMetadata(this.name, input.season, seasonType, "mock.player-game-log") };
    const games: HistoricalGameLogEntry[] = [{ game: { gameId: "mock-1991-001", date: "1991-04-21", status: { state: "final" as const, period: 4, statusText: "Final" }, homeTeam: { ...teams[4]!, score: 109 }, awayTeam: { ...teams[0]!, score: 98 } }, matchup: "CHI vs. BOS", result: "W" as const, stats: { minutes: 38, points: 33, rebounds: 7, assists: 6 } }, { game: { gameId: "mock-1991-002", date: "1991-04-19", status: { state: "final" as const, period: 4, statusText: "Final" }, homeTeam: { ...teams[0]!, score: 101 }, awayTeam: { ...teams[4]!, score: 104 } }, matchup: "CHI @ BOS", result: "W" as const, stats: { minutes: 41, points: 29, rebounds: 5, assists: 8 } }].filter((entry) => (!input.dateFrom || entry.game.date >= input.dateFrom) && (!input.dateTo || entry.game.date <= input.dateTo));
    const result = page(games, input.limit, input.cursor);
    return { player, season: input.season, seasonType, games: result.items.map((game) => ({ ...game, player })), page: { limit: result.limit, hasMore: result.hasMore, isBoundedResult: result.isBoundedResult, ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) }, meta: historicalMetadata(this.name, input.season, seasonType, "mock.player-game-log") };
  }

  async getTeamSeasonStats(input: GetTeamSeasonStatsInput) {
    validateHistoricalInput(input.season, input.seasonType, undefined, undefined, input.perMode);
    const team = teams.find((candidate) => candidate.id === input.teamId);
    if (!team) throw new ProviderError("NOT_FOUND", `Team '${input.teamId}' was not found in mock data.`);
    if (team.id !== "CHI" || input.season !== "1990-91") throw new ProviderError("DATA_UNAVAILABLE", `Mock historical coverage does not include ${input.season} for '${input.teamId}'.`);
    const seasonType = input.seasonType ?? "Regular Season";
    const perMode = input.perMode ?? "PerGame";
    const stats: TraditionalStats = { gamesPlayed: seasonType === "Playoffs" ? 17 : 82, wins: seasonType === "Playoffs" ? 15 : 61, losses: seasonType === "Playoffs" ? 2 : 21, points: perMode === "Totals" ? (seasonType === "Playoffs" ? 1_820 : 9_012) : (seasonType === "Playoffs" ? 107.1 : 109.9) };
    return { teamSeasonStats: { team, season: input.season, seasonType, perMode, stats }, meta: historicalMetadata(this.name, input.season, seasonType, "mock.team-season") };
  }

  async getTeamGameLog(input: GetTeamGameLogInput) {
    validateHistoricalInput(input.season, input.seasonType, input.dateFrom, input.dateTo);
    const team = teams.find((candidate) => candidate.id === input.teamId);
    if (!team) throw new ProviderError("NOT_FOUND", `Team '${input.teamId}' was not found in mock data.`);
    const seasonType = input.seasonType ?? "Regular Season";
    if (team.id !== "CHI" || input.season !== "1990-91") return { team, season: input.season, seasonType, games: [], page: { limit: input.limit ?? 100, hasMore: false, isBoundedResult: false }, meta: historicalMetadata(this.name, input.season, seasonType, "mock.team-game-log") };
    const playerLog = await this.getPlayerGameLog({ playerId: "mock-jordan", season: input.season, seasonType, ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}), ...(input.dateTo ? { dateTo: input.dateTo } : {}), ...(input.limit ? { limit: input.limit } : {}), ...(input.cursor ? { cursor: input.cursor } : {}) });
    return {
      team,
      season: input.season,
      seasonType,
      games: playerLog.games.map(({ player: _player, stats: _playerStats, ...game }) => ({
        ...game,
        team,
        stats: {
          minutes: 240,
          points: game.game.homeTeam.id === team.id ? game.game.homeTeam.score ?? 0 : game.game.awayTeam.score ?? 0,
        },
      })),
      page: playerLog.page,
      meta: historicalMetadata(this.name, input.season, seasonType, "mock.team-game-log"),
    };
  }

  async getLeagueLeaders(input: GetLeagueLeadersInput): Promise<LeagueLeadersResponse> {
    validateHistoricalInput(input.season, input.seasonType, undefined, undefined, input.perMode);
    const seasonType = input.seasonType ?? "Regular Season";
    const perMode = input.perMode ?? "PerGame";
    const statCategory = input.statCategory.trim().toUpperCase();
    const validCategories = new Set(["PTS", "REB", "AST", "STL", "BLK", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "MIN"]);
    if (!validCategories.has(statCategory)) throw new ProviderError("INVALID_ARGUMENT", `statCategory '${input.statCategory}' is not supported.`);
    const leaders = [{ scope: "player" as const, rank: 1, player: players[6]!, statCategory, value: statCategory === "PTS" ? 31.5 : 6.6, season: input.season, seasonType, perMode }];
    const result = page(leaders, input.limit, input.cursor);
    return { season: input.season, seasonType, perMode, statCategory, leaders: result.items, page: { limit: result.limit, hasMore: result.hasMore, isBoundedResult: result.isBoundedResult, ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) }, meta: historicalMetadata(this.name, input.season, seasonType, "mock.league-leaders") };
  }

  async getLeagueStandings(input: GetLeagueStandingsInput): Promise<LeagueStandingsResponse> {
    validateHistoricalInput(input.season, input.seasonType);
    const seasonType = input.seasonType ?? "Regular Season";
    return { season: input.season, seasonType, standings: [{ team: teams[4]!, conference: "Eastern", division: "Central", wins: 61, losses: 21, winningPercentage: 0.744, gamesBehind: 0, conferenceRank: 1, divisionRank: 1 }], meta: historicalMetadata(this.name, input.season, seasonType, "mock.league-standings") };
  }

  async getHistoricalGameBoxScore(gameId: string): Promise<HistoricalGameBoxScoreResponse> {
    if (gameId !== finalGame.gameId) throw new ProviderError("NOT_FOUND", `Historical mock game '${gameId}' was not found.`);
    return { historicalGame: { game: finalGame, boxScore: { ...historicalBoxScore, teams: historicalBoxScore.teams.map((entry) => ({ ...entry })), players: historicalBoxScore.players.map((entry) => ({ ...entry })) } }, meta: { ...historicalMetadata(this.name, "2025-26", "Regular Season", "mock.historical-box-score"), coverage: "complete" } };
  }

  async getHistoricalGameEvents(input: GetHistoricalGameEventsInput): Promise<HistoricalGameEventsResponse> {
    if (input.gameId !== finalGame.gameId) throw new ProviderError("NOT_FOUND", `Historical mock game '${input.gameId}' was not found.`);
    const result = page(historicalEvents, input.limit, input.cursor);
    return { gameId: input.gameId, events: result.items.map((event) => ({ ...event })), page: { limit: result.limit, hasMore: result.hasMore, isBoundedResult: result.isBoundedResult, ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) }, meta: { ...historicalMetadata(this.name, "2025-26", "Regular Season", "mock.historical-play-by-play"), coverage: "complete" } };
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return this.capabilities;
  }
}
