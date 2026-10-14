import type { Config } from "../config.js";
import { CachedDataProvider } from "./CachedDataProvider.js";
import type { DataProvider } from "./DataProvider.js";
import { MockProvider } from "./mock/MockProvider.js";

const SCHEDULE_CACHE_TTL_SECONDS = 60;

export function createProvider(config: Config): DataProvider {
  let provider: DataProvider;

  switch (config.provider) {
    case "mock":
      provider = new MockProvider();
      break;
    case "nba-com":
      throw new Error("The nba.com provider adapter is planned but not implemented yet.");
  }

  return new CachedDataProvider(provider, {
    liveSeconds: config.cacheTtlLiveSeconds,
    rosterSeconds: config.cacheTtlRosterSeconds,
    scheduleSeconds: SCHEDULE_CACHE_TTL_SECONDS,
  });
}
