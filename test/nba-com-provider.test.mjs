import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { NbaComProvider } from "../dist/providers/NbaComProvider.js";
import { ProviderError } from "../dist/providers/ProviderError.js";

const fixtureDirectory = new URL("./fixtures/nba-com/", import.meta.url);
const fixtures = Object.fromEntries(await Promise.all(
  ["scoreboard", "boxscore", "playbyplay", "roster"].map(async (name) => [
    name,
    await readFile(new URL(`${name}.json`, fixtureDirectory), "utf8"),
  ]),
));

function fixtureFetch(input) {
  const url = String(input);
  const fixture = url.includes("todaysScoreboard") ? fixtures.scoreboard
    : url.includes("boxscore_") ? fixtures.boxscore
    : url.includes("playbyplay_") ? fixtures.playbyplay
    : url.includes("commonteamroster") ? fixtures.roster
    : undefined;
  return Promise.resolve(new Response(fixture ?? "not found", { status: fixture ? 200 : 404 }));
}

function provider() {
  return new NbaComProvider(fixtureFetch);
}

test("NbaComProvider normalizes fixture-backed live scoreboard and team search responses", async () => {
  const nba = provider();
  const live = await nba.getLiveGames();
  assert.equal(live.games.length, 1);
  assert.equal(live.games[0].status.state, "halftime");
  assert.equal(live.games[0].status.clock, "00:00");
  assert.equal(live.games[0].homeTeam.id, "1610612738");

  const todays = await nba.getTodaysGames({ date: "2025-10-21", timezone: "America/New_York" });
  assert.equal(todays.games.length, 2);
  assert.equal(todays.games[1].status.startsAt, "2025-10-22T00:30:00Z");

  const status = await nba.getGameStatus("0022500001");
  assert.equal(status.game.venue, "TD Garden");

  const lakers = await nba.searchTeams("LA Lakers");
  assert.deepEqual(lakers.teams, [{ id: "1610612747", abbreviation: "LAL", name: "Los Angeles Lakers", city: "Los Angeles" }]);
  const thunder = await nba.searchTeams("Thunder");
  assert.equal(thunder.teams[0].abbreviation, "OKC");
});

test("NbaComProvider normalizes fixture-backed box score, play-by-play, and roster responses", async () => {
  const nba = provider();
  const boxScore = await nba.getGameBoxScore("0022500001");
  assert.equal(boxScore.boxScore.status.clock, "04:18");
  assert.equal(boxScore.boxScore.teams[0].fieldGoalsMade, 31);
  assert.deepEqual(boxScore.boxScore.players[0], {
    player: { id: "1628369", fullName: "Jayson Tatum", firstName: "Jayson", lastName: "Tatum", teamId: "1610612738", position: "F", jerseyNumber: "0", active: true },
    teamId: "1610612738", starter: true, played: true, minutes: "27:34", points: 24, rebounds: 7, assists: 4, steals: 1, blocks: 1, turnovers: 2, plusMinus: 8,
  });

  const events = await nba.getRecentGameEvents({ gameId: "0022500001", limit: 1 });
  assert.equal(events.events.length, 1);
  assert.equal(events.events[0].eventId, "2");
  assert.equal(events.events[0].clock, "04:18");

  const roster = await nba.getTeamRoster("BOS");
  assert.equal(roster.roster.team.name, "Boston Celtics");
  assert.equal(roster.roster.players[0].fullName, "Jayson Tatum");
  assert.equal(roster.roster.players[0].teamId, "1610612738");
});

test("NbaComProvider returns typed errors for unsupported dates, unknown teams, and upstream HTTP failures", async () => {
  const nba = provider();
  await assert.rejects(
    nba.getTodaysGames({ date: "2020-01-01" }),
    (error) => error instanceof ProviderError && error.code === "DATA_UNAVAILABLE",
  );
  await assert.rejects(
    nba.getTeamRoster("not-a-team"),
    (error) => error instanceof ProviderError && error.code === "NOT_FOUND",
  );
  const unavailable = new NbaComProvider(() => Promise.resolve(new Response("blocked", { status: 403 })));
  await assert.rejects(
    unavailable.getLiveGames(),
    (error) => error instanceof ProviderError && error.code === "PROVIDER_UNAVAILABLE",
  );
});
