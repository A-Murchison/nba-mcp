import type { WithMetadata } from "../domain/models.js";
import type {
  DataProvider,
  GetRecentGameEventsInput,
  GetTodaysGamesInput,
  SearchPlayersInput,
} from "./DataProvider.js";

/** Cache durations used by the provider decorator. */
export interface CacheTtls {
  /** Live scoreboard, game status, box score, and play-by-play data. */
  liveSeconds: number;
  /** Team rosters and player/team lookup data. */
  rosterSeconds: number;
  /** Today's schedule, which changes less often than an in-progress game. */
  scheduleSeconds: number;
}

interface CacheEntry<T extends WithMetadata> {
  response: T;
  cachedAtMs: number;
}

type CacheableResponse = WithMetadata;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Adds in-memory TTL caching and request coalescing to any normalized provider.
 *
 * Failed provider calls are deliberately not cached. Cached objects are cloned at
 * both boundaries so callers cannot mutate data retained for later requests.
 */
export class CachedDataProvider implements DataProvider {
  readonly name: string;
  readonly capabilities;

  private readonly cache = new Map<string, CacheEntry<CacheableResponse>>();
  private readonly pending = new Map<string, Promise<CacheableResponse>>();

  constructor(
    private readonly provider: DataProvider,
    private readonly ttls: CacheTtls,
    private readonly now: () => number = Date.now,
  ) {
    this.name = provider.name;
    this.capabilities = provider.capabilities;
  }

  getLiveGames() {
    return this.getOrLoad("live-games", this.ttls.liveSeconds, () => this.provider.getLiveGames());
  }

  getTodaysGames(input: GetTodaysGamesInput = {}) {
    return this.getOrLoad(
      `todays-games:${input.date ?? "default"}:${input.timezone ?? "default"}`,
      this.ttls.scheduleSeconds,
      () => this.provider.getTodaysGames(input),
    );
  }

  getGameStatus(gameId: string) {
    return this.getOrLoad(`game-status:${gameId}`, this.ttls.liveSeconds, () => this.provider.getGameStatus(gameId));
  }

  getGameBoxScore(gameId: string) {
    return this.getOrLoad(`game-box-score:${gameId}`, this.ttls.liveSeconds, () => this.provider.getGameBoxScore(gameId));
  }

  getRecentGameEvents(input: GetRecentGameEventsInput) {
    return this.getOrLoad(
      `recent-game-events:${input.gameId}:${input.limit ?? 10}`,
      this.ttls.liveSeconds,
      () => this.provider.getRecentGameEvents(input),
    );
  }

  getTeamRoster(teamId: string) {
    return this.getOrLoad(`team-roster:${teamId}`, this.ttls.rosterSeconds, () => this.provider.getTeamRoster(teamId));
  }

  searchTeams(query: string) {
    return this.getOrLoad(`search-teams:${query}`, this.ttls.rosterSeconds, () => this.provider.searchTeams(query));
  }

  searchPlayers(input: SearchPlayersInput) {
    return this.getOrLoad(
      `search-players:${input.query}:${input.activeOnly ?? true}:${input.limit ?? 10}`, 
      this.ttls.rosterSeconds,
      () => this.provider.searchPlayers(input),
    );
  }

  getCapabilities() {
    return this.provider.getCapabilities();
  }

  private async getOrLoad<T extends CacheableResponse>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const nowMs = this.now();
    const entry = this.cache.get(key);
    if (entry && nowMs - entry.cachedAtMs < ttlSeconds * 1_000) {
      return this.withCacheMetadata(entry.response as T, "hit", entry.cachedAtMs, nowMs);
    }

    if (entry) this.cache.delete(key);

    let request = this.pending.get(key) as Promise<T> | undefined;
    if (!request) {
      request = load().then((response) => {
        const cachedAtMs = this.now();
        this.cache.set(key, { response: clone(response), cachedAtMs });
        return response;
      });
      this.pending.set(key, request);
      void request.then(
        () => this.pending.delete(key),
        () => this.pending.delete(key),
      );
    }

    const response = await request;
    return this.withCacheMetadata(response, "miss", this.now(), this.now());
  }

  private withCacheMetadata<T extends CacheableResponse>(response: T, cacheStatus: "hit" | "miss", cachedAtMs: number, nowMs: number): T {
    const result = clone(response);
    const lastUpdatedMs = Date.parse(result.meta.lastUpdated);
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - cachedAtMs) / 1_000));

    result.meta.cacheStatus = cacheStatus;
    result.meta.dataFreshnessSeconds = Number.isFinite(lastUpdatedMs)
      ? Math.max(0, Math.floor((nowMs - lastUpdatedMs) / 1_000))
      : result.meta.dataFreshnessSeconds + elapsedSeconds;

    return result;
  }
}
