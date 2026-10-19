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
  const cached = new CachedDataProvider(provider, { liveSeconds: 60, rosterSeconds: 60, scheduleSeconds: 60 });
  const first = await cached.getLiveGames();
  first.games[0].homeTeam.score = 999;
  const second = await cached.getLiveGames();

  assert.equal(first.meta.cacheStatus, "miss");
  assert.equal(second.meta.cacheStatus, "hit");
  assert.notEqual(second.games[0].homeTeam.score, 999);
});
