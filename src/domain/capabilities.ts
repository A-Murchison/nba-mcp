export interface ProviderCapabilities {
  /** Provider can return games that are currently in progress. */
  supportsLiveScores: boolean;
  /** Provider can return live or final player/team box scores. */
  supportsLiveBoxScores: boolean;
  /** Provider can return recent or full play-by-play events. */
  supportsPlayByPlay: boolean;
  /** Provider can return current team roster data. */
  supportsCurrentRosters: boolean;
  /** Provider can return player injury/availability data. */
  supportsInjuries: boolean;
  /** @deprecated Use the granular historical capability flags below. */
  supportsHistoricalStats: boolean;
  /** Provider can return traditional player aggregates for a historical season. */
  supportsPlayerSeasonStats: boolean;
  /** Provider can return historical player game logs. */
  supportsPlayerGameLogs: boolean;
  /** Provider can return traditional team aggregates for a historical season. */
  supportsTeamSeasonStats: boolean;
  /** Provider can return historical team game logs. */
  supportsTeamGameLogs: boolean;
  /** Provider can return ranked historical league leaders. */
  supportsLeagueLeaders: boolean;
  /** Provider can return final historical standings. */
  supportsHistoricalStandings: boolean;
  /** Provider can return final historical game box scores. */
  supportsHistoricalBoxScores: boolean;
  /** Provider can return historical play-by-play. */
  supportsHistoricalPlayByPlay: boolean;
  /** Expected live-data refresh cadence from the provider. */
  updateFrequencySeconds: number;
}

export const TOOL_NAMES = [
  "get_server_capabilities",
  "get_live_games",
  "get_todays_games",
  "get_games_this_week",
  "get_game_status",
  "get_game_box_score",
  "get_recent_game_events",
  "get_team_roster",
  "search_teams",
  "search_players",
  "get_player_season_stats",
  "get_player_game_log",
  "get_team_season_stats",
  "get_team_game_log",
  "get_league_leaders",
  "get_league_standings",
  "get_historical_game_box_score",
  "get_historical_game_events",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export interface ServerCapabilities {
  serverName: "nba-mcp";
  version: string;
  activeProvider: string;
  supportedTools: readonly ToolName[];
  providerCapabilities: ProviderCapabilities;
  liveUpdateFrequencySeconds: number;
  knownLimitations: string[];
}
