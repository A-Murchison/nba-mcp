import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { NbaComProvider } from "../dist/providers/NbaComProvider.js";
import { ProviderError } from "../dist/providers/ProviderError.js";

const fixtureDirectory = new URL("./fixtures/nba-com/", import.meta.url);
const fixtures = Object.fromEntries(await Promise.all(
  ["scoreboard", "gamecard", "boxscore", "playbyplay", "roster"].map(async (name) => [
    name,
    await readFile(new URL(`${name}.json`, fixtureDirectory), "utf8"),
  ]),
));

function fixtureFetch(input) {
  const url = String(input);
  const fixture = url.includes("todaysScoreboard") ? fixtures.scoreboard
    : url.includes("scheduleLeagueV2_1") ? fixtures.gamecard
    : url.includes("boxscore_") ? fixtures.boxscore
    : url.includes("playbyplay_") ? fixtures.playbyplay
    : url.includes("commonteamroster") ? fixtures.roster
    : undefined;
  return Promise.resolve(new Response(fixture ?? "not found", { status: fixture ? 200 : 404 }));
}

function provider() {
  return new NbaComProvider(fixtureFetch);
}

test("NbaComProvider uses the CDN scoreboard for fixture-backed live games and status", async () => {
  const nba = provider();
  const live = await nba.getLiveGames();
  assert.equal(live.games.length, 1);
  assert.equal(live.games[0].status.state, "halftime");
  assert.equal(live.games[0].status.clock, "00:00");
  assert.equal(live.games[0].homeTeam.id, "1610612738");

  const todays = await nba.getTodaysGames({ date: "2026-10-20", timezone: "America/New_York" });
  assert.equal(todays.date, "2026-10-20");
  assert.equal(todays.games.length, 1);
  assert.equal(todays.games[0].date, "2026-10-20");
  assert.equal(todays.games[0].status.startsAt, "2026-10-20T23:30:00Z");

  const weekly = await nba.getGamesThisWeek({ date: "2026-10-20", timezone: "America/New_York" });
  assert.equal(weekly.startDate, "2026-10-19");
  assert.equal(weekly.endDate, "2026-10-25");
  assert.equal(weekly.games.length, 1);

  const status = await nba.getGameStatus("0022500001");
  assert.equal(status.game.venue, "TD Garden");

  const lakers = await nba.searchTeams("LA Lakers");
  assert.deepEqual(lakers.teams, [{ id: "1610612747", abbreviation: "LAL", name: "Los Angeles Lakers", city: "Los Angeles" }]);
  const thunder = await nba.searchTeams("Thunder");
  assert.equal(thunder.teams[0].abbreviation, "OKC");
});

test("NbaComProvider uses the CDN scoreboard first with the configured browser headers", async () => {
  const requests = [];
  const nba = new NbaComProvider((input, init) => {
    requests.push({ url: String(input), headers: init.headers });
    return fixtureFetch(input);
  });

  const live = await nba.getLiveGames();
  assert.equal(live.games.length, 1);
  assert.equal(requests.some((request) => request.url.includes("scheduleLeagueV2_1")), false);
  const cdnHeaders = requests.find((request) => request.url.includes("todaysScoreboard")).headers;
  assert.equal(cdnHeaders.Accept, "*/*");
  assert.equal(cdnHeaders["Accept-Language"], "en-US,en;q=0.9");
  assert.equal(cdnHeaders.Origin, "https://www.nba.com");
  assert.equal(cdnHeaders.Referer, "https://www.nba.com/");
  assert.equal(cdnHeaders["Sec-Fetch-Dest"], "empty");
  assert.equal(cdnHeaders["Sec-Fetch-Mode"], "cors");
  assert.equal(cdnHeaders["Sec-Fetch-Site"], "same-site");
  assert.equal(cdnHeaders.Priority, "u=4");
  assert.equal(cdnHeaders["User-Agent"], "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0");
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

test("NbaComProvider uses CDN browser headers and retries rate-limited schedule requests", async () => {
  const requests = [];
  let activeScheduleRequests = 0;
  let maximumActiveScheduleRequests = 0;
  let gamecardAttempts = 0;
  const request = async (input, init) => {
    const url = String(input);
    requests.push({ url, headers: init.headers });
    if (url.includes("scheduleLeagueV2_1")) {
      gamecardAttempts += 1;
      if (gamecardAttempts === 1) return new Response("rate limited", { status: 429, headers: { "Retry-After": "0" } });
      activeScheduleRequests += 1;
      maximumActiveScheduleRequests = Math.max(maximumActiveScheduleRequests, activeScheduleRequests);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeScheduleRequests -= 1;
    }
    return fixtureFetch(input);
  };
  const nba = new NbaComProvider(request);

  await nba.getLiveGames();
  await nba.getTodaysGames({ date: "2026-10-20" });
  await nba.getTeamRoster("BOS");
  await nba.getGamesThisWeek({ date: "2026-10-20" });

  assert.equal(gamecardAttempts, 3);
  assert.ok(maximumActiveScheduleRequests <= 1);
  assert.equal(requests.filter((request) => request.url.includes("todaysScoreboard")).length, 1);
  const coreHeaders = requests.find((request) => request.url.includes("scheduleLeagueV2_1")).headers;
  const statsHeaders = requests.find((request) => request.url.includes("commonteamroster")).headers;
  assert.equal(coreHeaders.Accept, "*/*");
  assert.equal(coreHeaders.Referer, "https://www.nba.com/");
  assert.equal(statsHeaders["User-Agent"], "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0");
  assert.equal(statsHeaders.Origin, "https://www.nba.com");
  assert.equal(statsHeaders["x-nba-stats-origin"], "stats");
  assert.equal(statsHeaders["x-nba-stats-token"], "true");
});

test("NbaComProvider returns typed errors for unknown teams and upstream HTTP failures", async () => {
  const nba = provider();
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
