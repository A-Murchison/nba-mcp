import { config as loadEnvFile } from "dotenv";

// Local configuration is optional; explicit process environment values still take precedence.
loadEnvFile({ path: ".env.local", quiet: true });

export interface Config {
  provider: "mock" | "nba-com";
  apiKey?: string;
  cacheTtlLiveSeconds: number;
  cacheTtlRosterSeconds: number;
  cacheTtlHistoricalSeconds: number;
  cacheTtlHistoricalLogSeconds: number;
  timezone: string;
  logLevel: "debug" | "info" | "warn" | "error";
}

function integerFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = env[name];
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const provider = env.NBA_MCP_PROVIDER ?? "mock";
  if (provider !== "mock" && provider !== "nba-com") {
    throw new Error("NBA_MCP_PROVIDER must be either 'mock' or 'nba-com'.");
  }

  const logLevel = env.NBA_MCP_LOG_LEVEL ?? "info";
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error("NBA_MCP_LOG_LEVEL must be one of: debug, info, warn, error.");
  }

  return {
    provider,
    ...(env.NBA_MCP_API_KEY ? { apiKey: env.NBA_MCP_API_KEY } : {}),
    cacheTtlLiveSeconds: integerFromEnv(env, "NBA_MCP_CACHE_TTL_LIVE_SECONDS", 10),
    cacheTtlRosterSeconds: integerFromEnv(env, "NBA_MCP_CACHE_TTL_ROSTER_SECONDS", 86_400),
    cacheTtlHistoricalSeconds: integerFromEnv(env, "NBA_MCP_CACHE_TTL_HISTORICAL_SECONDS", 604_800),
    cacheTtlHistoricalLogSeconds: integerFromEnv(env, "NBA_MCP_CACHE_TTL_HISTORICAL_LOG_SECONDS", 86_400),
    timezone: env.NBA_MCP_TIMEZONE ?? "America/New_York",
    logLevel: logLevel as Config["logLevel"],
  };
}
