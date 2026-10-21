import type { ProviderCapabilities } from "../domain/capabilities.js";
import type {
  GameBoxScoreResponse,
  GamesThisWeekResponse,
  HistoricalGameBoxScoreResponse,
  HistoricalGameEventsResponse,
  LeagueLeadersResponse,
  LeagueStandingsResponse,
  GameStatusResponse,
  LiveGamesResponse,
  RecentGameEventsResponse,
  SearchPlayersResponse,
  SearchTeamsResponse,
  TeamGameLogResponse,
  TeamRosterResponse,
  TeamSeasonStatsResponse,
  PlayerGameLogResponse,
  PlayerSeasonStatsResponse,
  TodaysGamesResponse,
} from "../domain/models.js";

export interface GetTodaysGamesInput {
  /** YYYY-MM-DD. Defaults to the server's configured local date when omitted. */
  date?: string;
  /** IANA timezone, for example America/New_York. */
  timezone?: string;
}

export interface GetGamesThisWeekInput {
  /** Any YYYY-MM-DD date in the requested Monday-through-Sunday week. */
  date?: string;
  /** IANA timezone, for example America/New_York. */
  timezone?: string;
}

export interface GetRecentGameEventsInput {
  gameId: string;
  limit?: number;
}

export interface SearchPlayersInput {
  query: string;
  activeOnly?: boolean;
  limit?: number;
}

export type HistoricalSeasonType = "Regular Season" | "Playoffs";
export type HistoricalPerMode = "PerGame" | "Totals";

export interface HistoricalSeasonInput {
  season: string;
  seasonType?: HistoricalSeasonType;
  perMode?: HistoricalPerMode;
}

export interface GetPlayerSeasonStatsInput extends HistoricalSeasonInput { playerId: string; }
export interface GetTeamSeasonStatsInput extends HistoricalSeasonInput { teamId: string; }
export interface GetPlayerGameLogInput extends Omit<HistoricalSeasonInput, "perMode"> {
  playerId: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}
export interface GetTeamGameLogInput extends Omit<HistoricalSeasonInput, "perMode"> {
  teamId: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}
export interface GetLeagueLeadersInput extends HistoricalSeasonInput {
  statCategory: string;
  limit?: number;
  cursor?: string;
}
export interface GetLeagueStandingsInput {
  season: string;
  seasonType?: HistoricalSeasonType;
}
export interface GetHistoricalGameEventsInput {
  gameId: string;
  limit?: number;
  cursor?: string;
}

/**
 * Provider-neutral contract used by MCP tools and domain services.
 *
 * Implementations must return canonical internal models, never raw upstream
 * provider payloads. Every successful response includes freshness metadata.
 */
export interface DataProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  getLiveGames(): Promise<LiveGamesResponse>;
  getTodaysGames(input?: GetTodaysGamesInput): Promise<TodaysGamesResponse>;
  getGamesThisWeek(input?: GetGamesThisWeekInput): Promise<GamesThisWeekResponse>;
  getGameStatus(gameId: string): Promise<GameStatusResponse>;
  getGameBoxScore(gameId: string): Promise<GameBoxScoreResponse>;
  getRecentGameEvents(input: GetRecentGameEventsInput): Promise<RecentGameEventsResponse>;
  getTeamRoster(teamId: string): Promise<TeamRosterResponse>;
  searchTeams(query: string): Promise<SearchTeamsResponse>;
  searchPlayers(input: SearchPlayersInput): Promise<SearchPlayersResponse>;
  getPlayerSeasonStats(input: GetPlayerSeasonStatsInput): Promise<PlayerSeasonStatsResponse>;
  getPlayerGameLog(input: GetPlayerGameLogInput): Promise<PlayerGameLogResponse>;
  getTeamSeasonStats(input: GetTeamSeasonStatsInput): Promise<TeamSeasonStatsResponse>;
  getTeamGameLog(input: GetTeamGameLogInput): Promise<TeamGameLogResponse>;
  getLeagueLeaders(input: GetLeagueLeadersInput): Promise<LeagueLeadersResponse>;
  getLeagueStandings(input: GetLeagueStandingsInput): Promise<LeagueStandingsResponse>;
  getHistoricalGameBoxScore(gameId: string): Promise<HistoricalGameBoxScoreResponse>;
  getHistoricalGameEvents(input: GetHistoricalGameEventsInput): Promise<HistoricalGameEventsResponse>;
  getCapabilities(): Promise<ProviderCapabilities>;
}
