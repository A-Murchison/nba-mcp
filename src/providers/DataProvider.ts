import type { ProviderCapabilities } from "../domain/capabilities.js";
import type {
  GameBoxScoreResponse,
  GamesThisWeekResponse,
  GameStatusResponse,
  LiveGamesResponse,
  RecentGameEventsResponse,
  SearchPlayersResponse,
  SearchTeamsResponse,
  TeamRosterResponse,
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
  getCapabilities(): Promise<ProviderCapabilities>;
}
