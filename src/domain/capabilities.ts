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
  /** Provider can return historical stats beyond current live/current-season context. */
  supportsHistoricalStats: boolean;
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
