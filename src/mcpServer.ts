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
      "nba.com schedule lookups use the public gamecard feed for current and upcoming dates; player search is unavailable with that provider.",
      "Betting, odds, fantasy projections, shot charts, and historical analytics are unavailable.",
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

  return server;
}
