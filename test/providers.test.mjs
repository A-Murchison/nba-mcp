import assert from "node:assert/strict";
import test from "node:test";

import { MockProvider } from "../dist/providers/mock/MockProvider.js";
import { CachedDataProvider } from "../dist/providers/CachedDataProvider.js";

const provider = new MockProvider();

function assertMetadata(response) {
  assert.equal(typeof response.meta.source, "string");
  assert.match(response.meta.lastUpdated, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof response.meta.dataFreshnessSeconds, "number");
  assert.ok(["bypass", "hit", "miss", "stale"].includes(response.meta.cacheStatus));
}

test("MockProvider satisfies the provider contract with normalized responses", async () => {
  const live = await provider.getLiveGames();
  assertMetadata(live);
  assert.ok(live.games.length > 0);
  assert.equal(live.games[0].status.state, "in_progress");

  const gameId = live.games[0].gameId;
  const responses = [
    await provider.getTodaysGames(),
    await provider.getGameStatus(gameId),
    await provider.getGameBoxScore(gameId),
    await provider.getRecentGameEvents({ gameId, limit: 2 }),
    await provider.getTeamRoster("BOS"),
    await provider.searchTeams("boston"),
    await provider.searchPlayers({ query: "tatum" }),
  ];
  responses.forEach(assertMetadata);
  assert.equal(responses[1].game.gameId, gameId);
  assert.equal(responses[2].boxScore.gameId, gameId);
  assert.ok(responses[3].events.length <= 2);
  assert.equal(responses[4].roster.team.id, "BOS");
  assert.equal(responses[5].teams[0].abbreviation, "BOS");
  assert.equal(responses[6].players[0].fullName, "Jayson Tatum");
});

test("CachedDataProvider returns a miss then a hit without mutating cached data", async () => {
  const cached = new CachedDataProvider(provider, { liveSeconds: 60, rosterSeconds: 60, scheduleSeconds: 60, historicalSeconds: 60, historicalLogSeconds: 60 });
  const first = await cached.getLiveGames();
  first.games[0].homeTeam.score = 999;
  const second = await cached.getLiveGames();

  assert.equal(first.meta.cacheStatus, "miss");
  assert.equal(second.meta.cacheStatus, "hit");
  assert.notEqual(second.games[0].homeTeam.score, 999);
});

test("MockProvider returns season-scoped historical aggregates and filtered logs", async () => {
  const regular = await provider.getPlayerSeasonStats({ playerId: "mock-jordan", season: "1990-91" });
  const playoffs = await provider.getPlayerSeasonStats({ playerId: "mock-jordan", season: "1990-91", seasonType: "Playoffs", perMode: "Totals" });
  const log = await provider.getPlayerGameLog({ playerId: "mock-jordan", season: "1990-91", dateFrom: "1991-04-20", limit: 1 });
  const noGames = await provider.getTeamGameLog({ teamId: "CHI", season: "1991-92" });

  assertMetadata(regular);
  assert.equal(regular.meta.season, "1990-91");
  assert.equal(regular.meta.seasonType, "Regular Season");
  assert.equal(regular.playerSeasonStats.stats.points, 31.5);
  assert.equal(playoffs.playerSeasonStats.stats.points, 529);
  assert.equal(log.games.length, 1);
  assert.equal(log.games[0].game.date, "1991-04-21");
  assert.deepEqual(noGames.games, []);
  assert.equal(noGames.page.hasMore, false);
});

test("historical validation and cache keys preserve every result-changing filter", async () => {
  await assert.rejects(
    provider.getPlayerGameLog({ playerId: "mock-jordan", season: "1990", dateFrom: "1991-04-22", dateTo: "1991-04-21" }),
    { code: "INVALID_ARGUMENT" },
  );

  let calls = 0;
  const source = new MockProvider();
  const original = source.getPlayerGameLog.bind(source);
  source.getPlayerGameLog = async (input) => { calls += 1; return original(input); };
  const cached = new CachedDataProvider(source, { liveSeconds: 60, rosterSeconds: 60, scheduleSeconds: 60, historicalSeconds: 60, historicalLogSeconds: 60 });
  await cached.getPlayerGameLog({ playerId: "mock-jordan", season: "1990-91", limit: 1 });
  await cached.getPlayerGameLog({ playerId: "mock-jordan", season: "1990-91", limit: 2 });
  assert.equal(calls, 2);
});
