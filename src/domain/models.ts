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
