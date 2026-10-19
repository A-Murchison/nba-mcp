export type ISODateString = string;
export type ISODateTimeString = string;

export type GameStatusState = "scheduled" | "in_progress" | "halftime" | "final" | "postponed" | "cancelled";
export type CacheStatus = "hit" | "miss" | "stale" | "bypass";
export type TeamSide = "home" | "away";

export interface ResponseMetadata {
  /** Provider name or logical data source that produced this response. */
  source: string;
  /** ISO timestamp for when the provider data was last observed/updated. */
  lastUpdated: ISODateTimeString;
  /** Age of the provider data at response time. */
  dataFreshnessSeconds: number;
  /** True when this response describes live/in-progress data. */
  isLive: boolean;
  /** Cache outcome for the request. Phase 1 providers can use bypass until caching exists. */
  cacheStatus: CacheStatus;
  /** Time spent in the provider adapter, when known. */
  providerLatencyMs?: number;
  /** Upstream dataset used for a historical response, when applicable. */
  dataset?: string;
  /** Explicit requested historical season, when applicable. */
  season?: Season;
  /** Explicit requested competition phase, when applicable. */
  seasonType?: SeasonType;
  /** Whether the upstream coverage is complete, partial, or unknown. */
  coverage?: "complete" | "partial" | "unknown";
  /** Non-authoritative caveat about source coverage or result completeness. */
  coverageNote?: string;
}

export interface WithMetadata {
  meta: ResponseMetadata;
}

export interface Team {
  id: string;
  abbreviation: string;
  name: string;
  city?: string;
  conference?: "Eastern" | "Western";
  division?: string;
}

export interface Player {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  teamId?: string;
  position?: string;
  jerseyNumber?: string;
  active: boolean;
  height?: string;
  weight?: string;
  status?: string;
}

export interface TeamScore extends Team {
  score?: number;
}

export interface GameStatus {
  state: GameStatusState;
  period: number;
  clock?: string;
  statusText: string;
  startsAt?: ISODateTimeString;
  possessionTeamId?: string;
}

export interface Game {
  gameId: string;
  date: ISODateString;
  status: GameStatus;
  homeTeam: TeamScore;
  awayTeam: TeamScore;
  venue?: string;
}

export interface LiveGame extends Game {
  status: GameStatus & { state: "in_progress" | "halftime" };
  homeTeam: TeamScore & { score: number };
  awayTeam: TeamScore & { score: number };
}

export interface TeamBoxScore {
  team: Team;
  minutes?: string;
  points: number;
  rebounds: number;
  offensiveRebounds?: number;
  defensiveRebounds?: number;
  assists: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
  fouls?: number;
  fieldGoalsMade?: number;
  fieldGoalsAttempted?: number;
  threePointersMade?: number;
  threePointersAttempted?: number;
  freeThrowsMade?: number;
  freeThrowsAttempted?: number;
}

export interface PlayerBoxScore {
  player: Player;
  teamId: string;
  starter?: boolean;
  played: boolean;
  minutes?: string;
  points: number;
  rebounds: number;
  offensiveRebounds?: number;
  defensiveRebounds?: number;
  assists: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
  fouls?: number;
  fieldGoalsMade?: number;
  fieldGoalsAttempted?: number;
  threePointersMade?: number;
  threePointersAttempted?: number;
  freeThrowsMade?: number;
  freeThrowsAttempted?: number;
  plusMinus?: number;
}

export interface BoxScore {
  gameId: string;
  status: GameStatus;
  teams: TeamBoxScore[];
  players: PlayerBoxScore[];
}

export interface PlayByPlayEvent {
  eventId: string;
  gameId: string;
  period: number;
  clock?: string;
  sequenceNumber?: number;
  teamId?: string;
  playerId?: string;
  eventType: string;
  description: string;
  scoreHome?: number;
  scoreAway?: number;
  occurredAt?: ISODateTimeString;
}

export interface Roster {
  team: Team;
  players: Player[];
  season?: string;
}

export interface LiveGamesResponse extends WithMetadata {
  games: LiveGame[];
}

export interface TodaysGamesResponse extends WithMetadata {
  date: ISODateString;
  timezone: string;
  games: Game[];
}

export interface GamesThisWeekResponse extends WithMetadata {
  /** Inclusive Monday-through-Sunday range in the requested timezone. */
  startDate: ISODateString;
  endDate: ISODateString;
  timezone: string;
  games: Game[];
}

export interface GameStatusResponse extends WithMetadata {
  game: Game;
}

export interface GameBoxScoreResponse extends WithMetadata {
  boxScore: BoxScore;
}

export interface RecentGameEventsResponse extends WithMetadata {
  gameId: string;
  events: PlayByPlayEvent[];
}

export interface TeamRosterResponse extends WithMetadata {
  roster: Roster;
}

export interface SearchTeamsResponse extends WithMetadata {
  query: string;
  teams: Team[];
}

export interface SearchPlayersResponse extends WithMetadata {
  query: string;
  players: Player[];
}

/** NBA season label, formatted as YYYY-YY (for example 2023-24). */
export type Season = string;
export type SeasonType = "Regular Season" | "Playoffs";
export type PerMode = "PerGame" | "Totals";
export type StatScope = "player" | "team";

/** Request pagination. Cursors are opaque provider-neutral strings. */
export interface Pagination {
  limit?: number;
  cursor?: string;
}

/** Result pagination and completeness information. */
export interface PageInfo {
  limit: number;
  nextCursor?: string;
  hasMore: boolean;
  /** True when a requested bounded page may omit further matching records. */
  isBoundedResult: boolean;
}

/** Traditional counting statistics. Undefined means the source did not supply a field. */
export interface TraditionalStats {
  gamesPlayed?: number;
  gamesStarted?: number;
  minutes?: number;
  points?: number;
  rebounds?: number;
  offensiveRebounds?: number;
  defensiveRebounds?: number;
  assists?: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
  fouls?: number;
  fieldGoalsMade?: number;
  fieldGoalsAttempted?: number;
  threePointersMade?: number;
  threePointersAttempted?: number;
  freeThrowsMade?: number;
  freeThrowsAttempted?: number;
  wins?: number;
  losses?: number;
}

export interface PlayerSeasonStats {
  player: Player;
  season: Season;
  seasonType: SeasonType;
  perMode: PerMode;
  stats: TraditionalStats;
}

export interface TeamSeasonStats {
  team: Team;
  season: Season;
  seasonType: SeasonType;
  perMode: PerMode;
  stats: TraditionalStats;
}

export interface HistoricalGameLogEntry {
  game: Game;
  matchup?: string;
  result?: "W" | "L";
  stats: TraditionalStats;
}

export interface PlayerGameLogEntry extends HistoricalGameLogEntry {
  player: Player;
}

export interface TeamGameLogEntry extends HistoricalGameLogEntry {
  team: Team;
}

export interface LeagueLeader {
  scope: StatScope;
  rank: number;
  player?: Player;
  team?: Team;
  statCategory: string;
  value: number;
  season: Season;
  seasonType: SeasonType;
  perMode: PerMode;
}

export interface StandingsEntry {
  team: Team;
  conference?: string;
  division?: string;
  wins: number;
  losses: number;
  winningPercentage?: number;
  gamesBehind?: number;
  conferenceRank?: number;
  divisionRank?: number;
}

/** A final game returned by a provider's historical data path. */
export interface HistoricalGame {
  game: Game;
  boxScore?: BoxScore;
}

export interface PlayerSeasonStatsResponse extends WithMetadata {
  playerSeasonStats: PlayerSeasonStats;
}

export interface TeamSeasonStatsResponse extends WithMetadata {
  teamSeasonStats: TeamSeasonStats;
}

export interface PlayerGameLogResponse extends WithMetadata {
  player: Player;
  season: Season;
  seasonType: SeasonType;
  games: PlayerGameLogEntry[];
  page: PageInfo;
}

export interface TeamGameLogResponse extends WithMetadata {
  team: Team;
  season: Season;
  seasonType: SeasonType;
  games: TeamGameLogEntry[];
  page: PageInfo;
}

export interface LeagueLeadersResponse extends WithMetadata {
  season: Season;
  seasonType: SeasonType;
  perMode: PerMode;
  statCategory: string;
  leaders: LeagueLeader[];
  page: PageInfo;
}

export interface LeagueStandingsResponse extends WithMetadata {
  season: Season;
  seasonType: SeasonType;
  standings: StandingsEntry[];
}

export interface HistoricalGameBoxScoreResponse extends WithMetadata {
  historicalGame: HistoricalGame;
}

export interface HistoricalGameEventsResponse extends WithMetadata {
  gameId: string;
  events: PlayByPlayEvent[];
  page: PageInfo;
}
