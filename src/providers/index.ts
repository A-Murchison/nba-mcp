import type { Config } from "../config.js";
import { CachedDataProvider } from "./CachedDataProvider.js";
import type { DataProvider } from "./DataProvider.js";
import { MockProvider } from "./mock/MockProvider.js";
import { NbaComProvider } from "./NbaComProvider.js";

const SCHEDULE_CACHE_TTL_SECONDS = 60;

export function createProvider(config: Config): DataProvider {
  let provider: DataProvider;

  switch (config.provider) {
    case "mock":
      provider = new MockProvider();
      break;
    case "nba-com":
      provider = new NbaComProvider();
      break;
  }

  return new CachedDataProvider(provider, {
    liveSeconds: config.cacheTtlLiveSeconds,
    rosterSeconds: config.cacheTtlRosterSeconds,
    scheduleSeconds: SCHEDULE_CACHE_TTL_SECONDS,
    historicalSeconds: config.cacheTtlHistoricalSeconds,
    historicalLogSeconds: config.cacheTtlHistoricalLogSeconds,
  });
}
