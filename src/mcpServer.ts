import { createRequire } from "node:module";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";

import type { Config } from "./config.js";
import { TOOL_NAMES, type ServerCapabilities } from "./domain/capabilities.js";
import { errorResponse, type ErrorResponse } from "./domain/errors.js";
import type { DataProvider } from "./providers/DataProvider.js";
import { createProvider } from "./providers/index.js";
import { ProviderError } from "./providers/ProviderError.js";

const SERVER_NAME = "nba-mcp";
const seasonSchema = z.string().regex(/^\d{4}-\d{2}$/).describe("NBA season in YYYY-YY format, for example 2023-24.");
const seasonTypeSchema = z.enum(["Regular Season", "Playoffs"]).optional().describe("Competition phase. Defaults to Regular Season.");
const perModeSchema = z.enum(["PerGame", "Totals"]).optional().describe("Aggregate presentation. Defaults to PerGame.");
const pageSchema = {
  limit: z.number().int().positive().max(100).optional().describe("Maximum number of results. Defaults to 100; max 100."),
  cursor: z.string().min(1).optional().describe("Opaque cursor returned by a previous response."),
};
const require = createRequire(import.meta.url);
const { version: SERVER_VERSION } = require("../package.json") as { version: string };

function toolResult(data: Record<string, unknown>, isError = false): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    ...(isError ? { isError: true } : {}),
  };
}

function errorToolResult(error: ErrorResponse): CallToolResult {
  return toolResult(error as unknown as Record<string, unknown>, true);
}

function internalErrorResult(error: unknown, providerName?: string): CallToolResult {
  if (error instanceof ProviderError) {
    return errorToolResult(
      errorResponse(error.code, error.message, {
        ...error.options,
        ...(providerName ? { provider: providerName } : {}),
      }),
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return errorToolResult(
    errorResponse("INTERNAL_ERROR", `NBA MCP tool failed: ${message}`, {
      ...(providerName ? { provider: providerName } : {}),
    }),
  );
}

async function handleTool<T>(provider: DataProvider, callback: () => Promise<T>): Promise<CallToolResult> {
  try {
    return toolResult((await callback()) as unknown as Record<string, unknown>);
  } catch (error: unknown) {
    return internalErrorResult(error, provider.name);
  }
}

export async function buildServerCapabilities(provider: DataProvider): Promise<ServerCapabilities> {
  const providerCapabilities = await provider.getCapabilities();

  return {
    serverName: SERVER_NAME,
    version: SERVER_VERSION,
    activeProvider: provider.name,
    supportedTools: TOOL_NAMES,
    providerCapabilities,
    liveUpdateFrequencySeconds: providerCapabilities.updateFrequencySeconds,
    knownLimitations: [
      "The nba.com adapter depends on public upstream endpoints and may be blocked, rate-limited, or changed without notice.",
      "nba.com schedule lookups use the CDN season schedule rather than the blocked core-api.nba.com gamecard feed; player search is unavailable with that provider.",
      "Historical Stats endpoints and CDN game archives are public upstream services that can be rate-limited, changed, or have partial coverage.",
      "Betting, odds, fantasy projections, shot charts, and generated analytics are unavailable.",
      "Live freshness depends on the active provider; live responses are cached only for the configured short TTL.",
    ],
  };
}

export function createNbaMcpServer(config: Config): McpServer {
  const provider = createProvider(config);
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "get_server_capabilities",
    {
      title: "Get server capabilities",
      description: "Return the NBA MCP server version, active provider, supported tools, provider capabilities, live update frequency, and known limitations.",
    },
    async () => handleTool(provider, () => buildServerCapabilities(provider)),
  );

  server.registerTool(
    "get_live_games",
    {
      title: "Get live NBA games",
      description: "Return all NBA games currently live, including score, game status, period, clock, possession when available, and freshness metadata.",
    },
    async () => handleTool(provider, () => provider.getLiveGames()),
  );

  server.registerTool(
    "get_todays_games",
    {
      title: "Get today's NBA games",
      description: "Return the NBA slate for a date, including scheduled, live, and final games. Defaults to the configured server timezone.",
      inputSchema: {
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Game date in YYYY-MM-DD format. Defaults to today from the provider/server context."),
        timezone: z.string().min(1).optional().describe("IANA timezone such as America/New_York. Defaults to NBA_MCP_TIMEZONE."),
      },
    },
    async ({ date, timezone }) =>
      handleTool(provider, () =>
        provider.getTodaysGames({
          ...(date ? { date } : {}),
          timezone: timezone ?? config.timezone,
        }),
      ),
  );

  server.registerTool(
    "get_games_this_week",
    {
      title: "Get this week's NBA games",
      description: "Return the NBA schedule for the Monday-through-Sunday week containing the requested date. Use this for questions such as 'What games are on this week?'.",
      inputSchema: {
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Any date in the requested week, in YYYY-MM-DD format. Defaults to today in the configured timezone."),
        timezone: z.string().min(1).optional().describe("IANA timezone such as America/New_York. Defaults to NBA_MCP_TIMEZONE."),
      },
    },
    async ({ date, timezone }) =>
      handleTool(provider, () =>
        provider.getGamesThisWeek({
          ...(date ? { date } : {}),
          timezone: timezone ?? config.timezone,
        }),
      ),
  );

  server.registerTool(
    "get_game_status",
    {
      title: "Get NBA game status",
      description: "Return focused status for one scheduled, live, or final game, including score, period, clock, and freshness metadata.",
      inputSchema: {
        game_id: z.string().min(1).describe("Canonical game ID returned by get_live_games, get_todays_games, or search workflows."),
      },
    },
    async ({ game_id }) => handleTool(provider, () => provider.getGameStatus(game_id)),
  );

  server.registerTool(
    "get_game_box_score",
    {
      title: "Get NBA game box score",
      description: "Return current team totals and player box score stats for a live or final game.",
      inputSchema: {
        game_id: z.string().min(1).describe("Canonical game ID returned by get_live_games or get_todays_games."),
      },
    },
    async ({ game_id }) => {
      if (!provider.capabilities.supportsLiveBoxScores) {
        return errorToolResult(
          errorResponse("UNSUPPORTED_CAPABILITY", "Live box scores are not available from the configured provider.", {
            suggestedAlternatives: ["Use get_game_status", "Use get_live_games"],
            provider: provider.name,
          }),
        );
      }

      return handleTool(provider, () => provider.getGameBoxScore(game_id));
    },
  );

  server.registerTool(
    "get_recent_game_events",
    {
      title: "Get recent NBA game events",
      description: "Return the most recent play-by-play events for a game when supported by the active provider.",
      inputSchema: {
        game_id: z.string().min(1).describe("Canonical game ID returned by get_live_games or get_todays_games."),
        limit: z.number().int().positive().max(50).optional().describe("Maximum number of recent events to return. Defaults to 10; max 50."),
      },
    },
    async ({ game_id, limit }) => {
      if (!provider.capabilities.supportsPlayByPlay) {
        return errorToolResult(
          errorResponse("UNSUPPORTED_CAPABILITY", "Live play-by-play is not available from the configured provider.", {
            suggestedAlternatives: ["Use get_game_box_score", "Use get_game_status"],
            provider: provider.name,
          }),
        );
      }

      return handleTool(provider, () => provider.getRecentGameEvents({ gameId: game_id, ...(limit ? { limit } : {}) }));
    },
  );

  server.registerTool(
    "get_team_roster",
    {
      title: "Get NBA team roster",
      description: "Return the current roster for a team, including player IDs, names, jersey numbers, positions, physical info when available, status, and freshness metadata.",
      inputSchema: {
        team_id: z.string().min(1).describe("Canonical team ID, for example BOS, LAL, DEN, or GSW from search_teams."),
      },
    },
    async ({ team_id }) => {
      if (!provider.capabilities.supportsCurrentRosters) {
        return errorToolResult(
          errorResponse("UNSUPPORTED_CAPABILITY", "Current rosters are not available from the configured provider.", {
            suggestedAlternatives: ["Use search_teams", "Use get_todays_games"],
            provider: provider.name,
          }),
        );
      }

      return handleTool(provider, () => provider.getTeamRoster(team_id));
    },
  );

  server.registerTool(
    "search_teams",
    {
      title: "Search NBA teams",
      description: "Resolve team names, cities, abbreviations, or common fragments to canonical team IDs.",
      inputSchema: {
        query: z.string().min(1).describe("Team search query, such as Lakers, Los Angeles, BOS, Boston, Warriors, or Golden State."),
      },
    },
    async ({ query }) => handleTool(provider, () => provider.searchTeams(query)),
  );

  server.registerTool(
    "search_players",
    {
      title: "Search NBA players",
      description: "Resolve current players by name and return canonical player IDs, team, position, jersey number, and active status.",
      inputSchema: {
        query: z.string().min(1).describe("Player name search query, such as jokic, curry, lebron, or tatum."),
        active_only: z.boolean().optional().describe("When true, only return active players. Defaults to true."),
        limit: z.number().int().positive().max(50).optional().describe("Maximum number of players to return. Defaults to 10; max 50."),
      },
    },
    async ({ query, active_only, limit }) =>
      handleTool(provider, () =>
        provider.searchPlayers({
          query,
          ...(active_only === undefined ? {} : { activeOnly: active_only }),
          ...(limit ? { limit } : {}),
        }),
      ),
  );

  server.registerTool(
    "get_player_season_stats",
    { title: "Get player season stats", description: "Return traditional player statistics for a historical NBA season.", inputSchema: { player_id: z.string().min(1).describe("Canonical NBA player ID."), season: seasonSchema, season_type: seasonTypeSchema, per_mode: perModeSchema } },
    async ({ player_id, season, season_type, per_mode }) => {
      if (!provider.capabilities.supportsPlayerSeasonStats) return errorToolResult(errorResponse("UNSUPPORTED_CAPABILITY", "Historical player season statistics are not available from the configured provider.", { provider: provider.name }));
      return handleTool(provider, () => provider.getPlayerSeasonStats({ playerId: player_id, season, ...(season_type ? { seasonType: season_type } : {}), ...(per_mode ? { perMode: per_mode } : {}) }));
    },
  );

  server.registerTool(
    "get_player_game_log",
    { title: "Get player game log", description: "Return paginated final games from a player's historical season.", inputSchema: { player_id: z.string().min(1).describe("Canonical NBA player ID."), season: seasonSchema, season_type: seasonTypeSchema, date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive YYYY-MM-DD date filter."), date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive YYYY-MM-DD date filter."), ...pageSchema } },
    async ({ player_id, season, season_type, date_from, date_to, limit, cursor }) => {
      if (!provider.capabilities.supportsPlayerGameLogs) return errorToolResult(errorResponse("UNSUPPORTED_CAPABILITY", "Historical player game logs are not available from the configured provider.", { provider: provider.name }));
      return handleTool(provider, () => provider.getPlayerGameLog({ playerId: player_id, season, ...(season_type ? { seasonType: season_type } : {}), ...(date_from ? { dateFrom: date_from } : {}), ...(date_to ? { dateTo: date_to } : {}), ...(limit ? { limit } : {}), ...(cursor ? { cursor } : {}) }));
    },
  );

  server.registerTool(
    "get_team_season_stats",
    { title: "Get team season stats", description: "Return traditional team statistics for a historical NBA season.", inputSchema: { team_id: z.string().min(1).describe("Canonical team abbreviation or NBA team ID."), season: seasonSchema, season_type: seasonTypeSchema, per_mode: perModeSchema } },
    async ({ team_id, season, season_type, per_mode }) => {
      if (!provider.capabilities.supportsTeamSeasonStats) return errorToolResult(errorResponse("UNSUPPORTED_CAPABILITY", "Historical team season statistics are not available from the configured provider.", { provider: provider.name }));
      return handleTool(provider, () => provider.getTeamSeasonStats({ teamId: team_id, season, ...(season_type ? { seasonType: season_type } : {}), ...(per_mode ? { perMode: per_mode } : {}) }));
    },
  );

  server.registerTool(
    "get_team_game_log",
    { title: "Get team game log", description: "Return paginated final games from a team's historical season.", inputSchema: { team_id: z.string().min(1).describe("Canonical team abbreviation or NBA team ID."), season: seasonSchema, season_type: seasonTypeSchema, date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive YYYY-MM-DD date filter."), date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive YYYY-MM-DD date filter."), ...pageSchema } },
    async ({ team_id, season, season_type, date_from, date_to, limit, cursor }) => {
      if (!provider.capabilities.supportsTeamGameLogs) return errorToolResult(errorResponse("UNSUPPORTED_CAPABILITY", "Historical team game logs are not available from the configured provider.", { provider: provider.name }));
      return handleTool(provider, () => provider.getTeamGameLog({ teamId: team_id, season, ...(season_type ? { seasonType: season_type } : {}), ...(date_from ? { dateFrom: date_from } : {}), ...(date_to ? { dateTo: date_to } : {}), ...(limit ? { limit } : {}), ...(cursor ? { cursor } : {}) }));
    },
  );

  server.registerTool(
    "get_league_leaders",
    { title: "Get league leaders", description: "Return paginated ranked traditional-stat leaders for a historical season.", inputSchema: { season: seasonSchema, season_type: seasonTypeSchema, per_mode: perModeSchema, stat_category: z.string().min(1).describe("Supported traditional stat category, such as PTS or REB."), ...pageSchema } },
    async ({ season, season_type, per_mode, stat_category, limit, cursor }) => {
      if (!provider.capabilities.supportsLeagueLeaders) return errorToolResult(errorResponse("UNSUPPORTED_CAPABILITY", "Historical league leaders are not available from the configured provider.", { provider: provider.name }));
      return handleTool(provider, () => provider.getLeagueLeaders({ season, statCategory: stat_category, ...(season_type ? { seasonType: season_type } : {}), ...(per_mode ? { perMode: per_mode } : {}), ...(limit ? { limit } : {}), ...(cursor ? { cursor } : {}) }));
    },
  );

  server.registerTool(
    "get_league_standings",
    { title: "Get league standings", description: "Return final NBA standings for a historical season.", inputSchema: { season: seasonSchema, season_type: seasonTypeSchema } },
    async ({ season, season_type }) => {
      if (!provider.capabilities.supportsHistoricalStandings) return errorToolResult(errorResponse("UNSUPPORTED_CAPABILITY", "Historical league standings are not available from the configured provider.", { provider: provider.name }));
      return handleTool(provider, () => provider.getLeagueStandings({ season, ...(season_type ? { seasonType: season_type } : {}) }));
    },
  );

  server.registerTool(
    "get_historical_game_box_score",
    { title: "Get historical game box score", description: "Return the final box score for an archived NBA game. Archive coverage is partial.", inputSchema: { game_id: z.string().trim().min(1).describe("Canonical NBA game ID.") } },
    async ({ game_id }) => {
      if (!provider.capabilities.supportsHistoricalBoxScores) return errorToolResult(errorResponse("UNSUPPORTED_CAPABILITY", "Historical game box scores are not available from the configured provider.", { provider: provider.name }));
      return handleTool(provider, () => provider.getHistoricalGameBoxScore(game_id));
    },
  );

  server.registerTool(
    "get_historical_game_events",
    { title: "Get historical game events", description: "Return paginated archived play-by-play events. Archive coverage is partial.", inputSchema: { game_id: z.string().trim().min(1).describe("Canonical NBA game ID."), ...pageSchema } },
    async ({ game_id, limit, cursor }) => {
      if (!provider.capabilities.supportsHistoricalPlayByPlay) return errorToolResult(errorResponse("UNSUPPORTED_CAPABILITY", "Historical game events are not available from the configured provider.", { provider: provider.name }));
      return handleTool(provider, () => provider.getHistoricalGameEvents({ gameId: game_id, ...(limit ? { limit } : {}), ...(cursor ? { cursor } : {}) }));
    },
  );

  return server;
}
