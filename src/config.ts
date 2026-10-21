import { config as loadEnvFile } from "dotenv";

// Local configuration is optional; explicit process environment values still take precedence.
loadEnvFile({ path: ".env.local", quiet: true });

export interface Config {
  provider: "mock" | "nba-com";
  cacheTtlLiveSeconds: number;
  cacheTtlRosterSeconds: number;
  cacheTtlHistoricalSeconds: number;
  cacheTtlHistoricalLogSeconds: number;
  timezone: string;
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

  const timezone = env.NBA_MCP_TIMEZONE ?? "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new Error("NBA_MCP_TIMEZONE must be a valid IANA timezone.");
  }

  return {
    provider,
    cacheTtlLiveSeconds: integerFromEnv(env, "NBA_MCP_CACHE_TTL_LIVE_SECONDS", 10),
    cacheTtlRosterSeconds: integerFromEnv(env, "NBA_MCP_CACHE_TTL_ROSTER_SECONDS", 86_400),
    cacheTtlHistoricalSeconds: integerFromEnv(env, "NBA_MCP_CACHE_TTL_HISTORICAL_SECONDS", 604_800),
    cacheTtlHistoricalLogSeconds: integerFromEnv(env, "NBA_MCP_CACHE_TTL_HISTORICAL_LOG_SECONDS", 86_400),
    timezone,
  };
}
