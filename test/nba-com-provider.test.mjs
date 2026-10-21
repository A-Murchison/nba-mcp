import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { NbaComProvider } from "../dist/providers/NbaComProvider.js";
import { ProviderError } from "../dist/providers/ProviderError.js";

const fixtureDirectory = new URL("./fixtures/nba-com/", import.meta.url);
const fixtures = Object.fromEntries(await Promise.all(
  ["scoreboard", "gamecard", "boxscore", "playbyplay", "historical-boxscore", "historical-playbyplay", "roster", "player-dashboard", "player-game-log", "player-info", "team-dashboard", "team-game-log", "league-leaders", "league-standings"].map(async (name) => [
    name,
    await readFile(new URL(`${name}.json`, fixtureDirectory), "utf8"),
  ]),
));

function fixtureFetch(input) {
  const url = String(input);
  const fixture = url.includes("todaysScoreboard") ? fixtures.scoreboard
    : url.includes("scheduleLeagueV2_1") ? fixtures.gamecard
    : url.includes("boxscore_0022300642") ? fixtures["historical-boxscore"]
    : url.includes("boxscore_") ? fixtures.boxscore
    : url.includes("playbyplay_0022300642") ? fixtures["historical-playbyplay"]
    : url.includes("playbyplay_") ? fixtures.playbyplay
    : url.includes("commonteamroster") ? fixtures.roster
    : url.includes("playerdashboardbygeneralsplits") ? fixtures["player-dashboard"]
    : url.includes("playergamelog") ? fixtures["player-game-log"]
    : url.includes("commonplayerinfo") ? fixtures["player-info"]
    : url.includes("teamdashboardbygeneralsplits") ? fixtures["team-dashboard"]
    : url.includes("teamgamelog") ? fixtures["team-game-log"]
    : url.includes("leagueleaders") ? fixtures["league-leaders"]
    : url.includes("leaguestandingsv3") ? fixtures["league-standings"]
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

  // A non-current explicit date uses the season schedule.
  const todays = await nba.getTodaysGames({ date: "2026-10-20", timezone: "UTC" });
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

  requests.length = 0;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  const explicitToday = await nba.getTodaysGames({ date: today, timezone: "UTC" });
  assert.equal(explicitToday.games[0].status.state, "halftime");
  assert.equal(requests.some((request) => request.url.includes("todaysScoreboard")), true);
  assert.equal(requests.some((request) => request.url.includes("scheduleLeagueV2_1")), false);
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
  await nba.getTodaysGames({ date: "2026-10-20", timezone: "UTC" });
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

test("NbaComProvider normalizes historical player season stats with NBA Stats headers", async () => {
  const requests = [];
  const nba = new NbaComProvider((input, init) => {
    requests.push({ url: String(input), headers: init.headers });
    return fixtureFetch(input);
  });

  const response = await nba.getPlayerSeasonStats({ playerId: "2544", season: "2023-24" });
  assert.equal(response.playerSeasonStats.player.fullName, "LeBron James");
  assert.equal(response.playerSeasonStats.player.teamId, "1610612747");
  assert.deepEqual(response.playerSeasonStats.stats, {
    gamesPlayed: 71, wins: 47, losses: 24, minutes: 35.3, points: 1822,
    rebounds: 515, offensiveRebounds: 56, defensiveRebounds: 459, assists: 574,
    steals: 89, blocks: 38, turnovers: 247, fouls: 78, fieldGoalsMade: 650,
    fieldGoalsAttempted: 1210, threePointersMade: 149, threePointersAttempted: 425,
    freeThrowsMade: 303, freeThrowsAttempted: 404,
  });
  assert.equal(response.meta.dataset, "stats.nba.com/playerdashboardbygeneralsplits");
  assert.equal(response.meta.seasonType, "Regular Season");
  assert.equal(response.meta.coverage, "unknown");
  assert.match(response.meta.coverageNote, /availability and historical coverage can change/);
  assert.equal(nba.capabilities.supportsPlayerSeasonStats, true);

  const dashboard = requests.find((request) => request.url.includes("playerdashboardbygeneralsplits"));
  assert.ok(dashboard.url.includes("PlayerID=2544"));
  assert.ok(dashboard.url.includes("Season=2023-24"));
  assert.ok(dashboard.url.includes("SeasonType=Regular+Season"));
  const statsRequests = requests.filter((request) => request.url.includes("playerdashboardbygeneralsplits") || request.url.includes("commonplayerinfo"));
  assert.equal(statsRequests.length, 2);
  for (const request of statsRequests) {
    assert.equal(request.headers.Accept, "application/json, text/plain, */*");
    assert.equal(request.headers["Accept-Language"], "en-US,en;q=0.9");
    assert.equal(request.headers.Origin, "https://www.nba.com");
    assert.equal(request.headers.Referer, "https://www.nba.com/");
    assert.equal(request.headers["Sec-Fetch-Dest"], "empty");
    assert.equal(request.headers["Sec-Fetch-Mode"], "cors");
    assert.equal(request.headers["Sec-Fetch-Site"], "same-site");
    assert.equal(request.headers.Priority, "u=4");
    assert.equal(request.headers["User-Agent"], "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0");
    assert.equal(request.headers["Cache-Control"], "no-cache");
    assert.equal(request.headers.Pragma, "no-cache");
    assert.equal(request.headers["x-nba-stats-origin"], "stats");
    assert.equal(request.headers["x-nba-stats-token"], "true");
    assert.equal("Cookie" in request.headers, false);
    assert.equal("Host" in request.headers, false);
  }

  await assert.rejects(
    nba.getPlayerSeasonStats({ playerId: "2544", season: "2023" }),
    (error) => error instanceof ProviderError && error.code === "INVALID_ARGUMENT",
  );
});

test("NbaComProvider normalizes and locally paginates historical player game logs", async () => {
  const requests = [];
  const nba = new NbaComProvider((input, init) => {
    requests.push({ url: String(input), headers: init.headers });
    return fixtureFetch(input);
  });

  const response = await nba.getPlayerGameLog({ playerId: "2544", season: "2023-24", dateFrom: "2024-01-01", dateTo: "2024-01-31", limit: 1 });
  assert.equal(response.games.length, 1);
  assert.equal(response.games[0].game.gameId, "0022300642");
  assert.equal(response.games[0].game.date, "2024-01-17");
  assert.equal(response.games[0].game.homeTeam.abbreviation, "LAL");
  assert.equal(response.games[0].game.awayTeam.abbreviation, "DAL");
  assert.equal(response.games[0].result, "W");
  assert.equal(response.games[0].stats.points, 26);
  assert.deepEqual(response.page, { limit: 1, hasMore: true, isBoundedResult: true, nextCursor: "1" });
  assert.equal(response.meta.dataset, "stats.nba.com/playergamelog");
  assert.equal(nba.capabilities.supportsPlayerGameLogs, true);

  const gameLogRequest = requests.find((request) => request.url.includes("playergamelog"));
  assert.ok(gameLogRequest.url.includes("DateFrom=01%2F01%2F2024"));
  assert.ok(gameLogRequest.url.includes("DateTo=01%2F31%2F2024"));
  assert.equal(gameLogRequest.headers.Accept, "application/json, text/plain, */*");
  assert.equal(gameLogRequest.headers["Accept-Language"], "en-US,en;q=0.9");
  assert.equal(gameLogRequest.headers.Origin, "https://www.nba.com");
  assert.equal(gameLogRequest.headers.Referer, "https://www.nba.com/");
  assert.equal(gameLogRequest.headers["Sec-Fetch-Dest"], "empty");
  assert.equal(gameLogRequest.headers["Sec-Fetch-Mode"], "cors");
  assert.equal(gameLogRequest.headers["Sec-Fetch-Site"], "same-site");
  assert.equal(gameLogRequest.headers.Priority, "u=4");
  assert.equal(gameLogRequest.headers["User-Agent"], "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0");
  assert.equal(gameLogRequest.headers["Cache-Control"], "no-cache");
  assert.equal(gameLogRequest.headers.Pragma, "no-cache");
  assert.equal(gameLogRequest.headers["x-nba-stats-origin"], "stats");
  assert.equal(gameLogRequest.headers["x-nba-stats-token"], "true");
  assert.equal("Cookie" in gameLogRequest.headers, false);
  assert.equal("Host" in gameLogRequest.headers, false);

  await assert.rejects(
    nba.getPlayerGameLog({ playerId: "2544", season: "2023-24", dateFrom: "2024-02-01", dateTo: "2024-01-01" }),
    (error) => error instanceof ProviderError && error.code === "INVALID_ARGUMENT",
  );
  const requestsBeforeInvalidDate = requests.length;
  await assert.rejects(
    nba.getPlayerGameLog({ playerId: "2544", season: "2023-24", dateFrom: "2024-02-30" }),
    (error) => error instanceof ProviderError && error.code === "INVALID_ARGUMENT",
  );
  assert.equal(requests.length, requestsBeforeInvalidDate, "invalid calendar dates must not reach the upstream provider");
});

test("NbaComProvider normalizes historical team season stats with canonical team IDs", async () => {
  const requests = [];
  const nba = new NbaComProvider((input, init) => {
    requests.push({ url: String(input), headers: init.headers });
    return fixtureFetch(input);
  });

  const response = await nba.getTeamSeasonStats({ teamId: "LAL", season: "2023-24", perMode: "Totals" });
  assert.equal(response.teamSeasonStats.team.id, "1610612747");
  assert.equal(response.teamSeasonStats.team.abbreviation, "LAL");
  assert.equal(response.teamSeasonStats.perMode, "Totals");
  assert.deepEqual(response.teamSeasonStats.stats, {
    gamesPlayed: 82, wins: 47, losses: 35, minutes: 48.2, points: 9588,
    rebounds: 3583, offensiveRebounds: 789, defensiveRebounds: 2794, assists: 2356,
    steals: 594, blocks: 424, turnovers: 1123, fouls: 1548, fieldGoalsMade: 3521,
    fieldGoalsAttempted: 7314, threePointersMade: 1080, threePointersAttempted: 2928,
    freeThrowsMade: 1462, freeThrowsAttempted: 1881,
  });
  assert.equal(response.meta.dataset, "stats.nba.com/teamdashboardbygeneralsplits");
  assert.equal(nba.capabilities.supportsTeamSeasonStats, true);

  const request = requests.find((candidate) => candidate.url.includes("teamdashboardbygeneralsplits"));
  assert.ok(request.url.includes("TeamID=1610612747"));
  assert.ok(request.url.includes("PerMode=Totals"));
  assert.equal(request.headers.Accept, "application/json, text/plain, */*");
  assert.equal(request.headers.Origin, "https://www.nba.com");
  assert.equal(request.headers["x-nba-stats-origin"], "stats");

  await assert.rejects(
    nba.getTeamSeasonStats({ teamId: "not-a-team", season: "2023-24" }),
    (error) => error instanceof ProviderError && error.code === "NOT_FOUND",
  );
});

test("NbaComProvider normalizes and locally paginates historical team game logs", async () => {
  const requests = [];
  const nba = new NbaComProvider((input, init) => {
    requests.push({ url: String(input), headers: init.headers });
    return fixtureFetch(input);
  });

  const response = await nba.getTeamGameLog({ teamId: "1610612747", season: "2023-24", dateFrom: "2024-01-01", limit: 1 });
  assert.equal(response.team.abbreviation, "LAL");
  assert.equal(response.games.length, 1);
  assert.equal(response.games[0].game.gameId, "0022300642");
  assert.equal(response.games[0].game.homeTeam.abbreviation, "LAL");
  assert.equal(response.games[0].game.awayTeam.abbreviation, "DAL");
  assert.equal(response.games[0].stats.points, 127);
  assert.deepEqual(response.page, { limit: 1, hasMore: true, isBoundedResult: true, nextCursor: "1" });
  assert.equal(response.meta.dataset, "stats.nba.com/teamgamelog");
  assert.equal(nba.capabilities.supportsTeamGameLogs, true);

  const request = requests.find((candidate) => candidate.url.includes("teamgamelog"));
  assert.ok(request.url.includes("TeamID=1610612747"));
  assert.ok(request.url.includes("DateFrom=01%2F01%2F2024"));
  assert.equal(request.headers.Accept, "application/json, text/plain, */*");
  assert.equal(request.headers["Accept-Language"], "en-US,en;q=0.9");
  assert.equal(request.headers.Origin, "https://www.nba.com");
  assert.equal(request.headers["Sec-Fetch-Mode"], "cors");
  assert.equal(request.headers["x-nba-stats-origin"], "stats");
  assert.equal("Cookie" in request.headers, false);

  await assert.rejects(
    nba.getTeamGameLog({ teamId: "LAL", season: "2023-24", cursor: "not-a-cursor" }),
    (error) => error instanceof ProviderError && error.code === "INVALID_ARGUMENT",
  );
});

test("NbaComProvider normalizes and paginates historical league leaders", async () => {
  const requests = [];
  const nba = new NbaComProvider((input, init) => {
    requests.push({ url: String(input), headers: init.headers });
    return fixtureFetch(input);
  });

  const response = await nba.getLeagueLeaders({ season: "2023-24", statCategory: "pts", limit: 1 });
  assert.equal(response.leaders.length, 1);
  assert.deepEqual(response.leaders[0], {
    scope: "player", rank: 1, player: { id: "203507", fullName: "Giannis Antetokounmpo", active: true, teamId: "1610612749" },
    team: { id: "1610612749", abbreviation: "MIL", name: "Milwaukee Bucks", city: "Milwaukee" },
    statCategory: "PTS", value: 2222, season: "2023-24", seasonType: "Regular Season", perMode: "PerGame",
  });
  assert.deepEqual(response.page, { limit: 1, hasMore: true, isBoundedResult: true, nextCursor: "1" });
  assert.equal(response.meta.dataset, "stats.nba.com/leagueleaders");
  assert.equal(nba.capabilities.supportsLeagueLeaders, true);

  const request = requests.find((candidate) => candidate.url.includes("leagueleaders"));
  assert.ok(request.url.includes("StatCategory=PTS"));
  assert.ok(request.url.includes("Scope=S"));
  assert.equal(request.headers.Accept, "application/json, text/plain, */*");
  assert.equal(request.headers["x-nba-stats-token"], "true");

  await assert.rejects(
    nba.getLeagueLeaders({ season: "2023-24", statCategory: "BAD" }),
    (error) => error instanceof ProviderError && error.code === "INVALID_ARGUMENT",
  );

  // NBA Stats has returned an HTML challenge page from this endpoint. Keep the
  // advertised capability, but surface that transient upstream response as a
  // typed provider failure instead of leaking a JSON parser error.
  const htmlResponse = new NbaComProvider(() => Promise.resolve(new Response("<html>challenge</html>", { status: 200 })));
  await assert.rejects(
    htmlResponse.getLeagueLeaders({ season: "2023-24", statCategory: "PTS" }),
    (error) => error instanceof ProviderError && error.code === "PROVIDER_UNAVAILABLE",
  );
});

test("NbaComProvider normalizes historical league standings", async () => {
  const requests = [];
  const nba = new NbaComProvider((input, init) => {
    requests.push({ url: String(input), headers: init.headers });
    return fixtureFetch(input);
  });
  const response = await nba.getLeagueStandings({ season: "2023-24" });
  assert.equal(response.standings.length, 2);
  assert.deepEqual(response.standings[0], { team: { id: "1610612738", abbreviation: "BOS", name: "Boston Celtics", city: "Boston" }, conference: "East", division: "Atlantic", wins: 64, losses: 18, winningPercentage: 0.78, gamesBehind: 0, conferenceRank: 1, divisionRank: 1 });
  assert.equal(response.meta.dataset, "stats.nba.com/leaguestandingsv3");
  assert.equal(nba.capabilities.supportsHistoricalStandings, true);

  const request = requests.find((candidate) => candidate.url.includes("leaguestandingsv3"));
  assert.ok(request.url.includes("LeagueID=00"));
  assert.ok(request.url.includes("Season=2023-24"));
  assert.ok(request.url.includes("SeasonType=Regular+Season"));
  assert.equal(request.headers.Accept, "application/json, text/plain, */*");
  assert.equal(request.headers["Accept-Language"], "en-US,en;q=0.9");
  assert.equal(request.headers.Origin, "https://www.nba.com");
  assert.equal(request.headers.Referer, "https://www.nba.com/");
  assert.equal(request.headers["Sec-Fetch-Dest"], "empty");
  assert.equal(request.headers["Sec-Fetch-Mode"], "cors");
  assert.equal(request.headers["Sec-Fetch-Site"], "same-site");
  assert.equal(request.headers.Priority, "u=4");
  assert.equal(request.headers["User-Agent"], "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0");
  assert.equal(request.headers["Cache-Control"], "no-cache");
  assert.equal(request.headers.Pragma, "no-cache");
  assert.equal(request.headers["x-nba-stats-origin"], "stats");
  assert.equal(request.headers["x-nba-stats-token"], "true");
  assert.equal("Cookie" in request.headers, false);
  assert.equal("Host" in request.headers, false);

  const historicalIdentity = new NbaComProvider(() => Promise.resolve(new Response(JSON.stringify({
    resultSets: [{ name: "Standings", headers: ["TeamID", "TeamCity", "TeamName", "TeamAbbreviation", "WINS", "LOSSES"], rowSet: [[1610612751, "New Jersey", "Nets", "NJN", 22, 60]] }],
  }))));
  const legacyStandings = await historicalIdentity.getLeagueStandings({ season: "2011-12" });
  assert.deepEqual(legacyStandings.standings[0].team, { id: "1610612751", abbreviation: "NJN", name: "New Jersey Nets", city: "New Jersey" });

  await assert.rejects(
    nba.getLeagueStandings({ season: "2023-24", seasonType: "Preseason" }),
    (error) => error instanceof ProviderError && error.code === "INVALID_ARGUMENT",
  );
});

test("NbaComProvider normalizes and paginates archived historical game detail", async () => {
  const requests = [];
  const nba = new NbaComProvider((input, init) => {
    requests.push({ url: String(input), headers: init.headers });
    return fixtureFetch(input);
  });

  const boxScore = await nba.getHistoricalGameBoxScore("0022300642");
  assert.equal(boxScore.historicalGame.game.date, "2024-01-27");
  assert.equal(boxScore.historicalGame.game.status.state, "final");
  assert.equal(boxScore.historicalGame.boxScore.players[0].player.fullName, "Bojan Bogdanovic");
  assert.equal(boxScore.meta.dataset, "cdn.nba.com/liveData/boxscore");
  assert.equal(boxScore.meta.season, "2023-24");
  assert.equal(boxScore.meta.coverage, "partial");

  const lateGame = new NbaComProvider(() => Promise.resolve(new Response(
    fixtures["historical-boxscore"].replace(
      '"gameTimeUTC": "2024-01-27T17:00:00Z"',
      '"gameTimeUTC": "2024-01-28T03:00:00Z", "gameTimeLocal": "2024-01-27T22:00:00-05:00"',
    ),
  )));
  const lateGameBoxScore = await lateGame.getHistoricalGameBoxScore("0022300642");
  assert.equal(lateGameBoxScore.historicalGame.game.date, "2024-01-27", "historical games use their local NBA date rather than the UTC date");

  const events = await nba.getHistoricalGameEvents({ gameId: "0022300642", limit: 2, cursor: "1" });
  assert.deepEqual(events.events.map((event) => event.eventId), ["685", "686"]);
  assert.equal(events.events[1].scoreAway, 118);
  assert.deepEqual(events.page, { limit: 2, hasMore: false, isBoundedResult: false });
  assert.equal(events.meta.dataset, "cdn.nba.com/liveData/playbyplay");
  assert.equal(events.meta.season, "2023-24");
  assert.equal(nba.capabilities.supportsHistoricalBoxScores, true);
  assert.equal(nba.capabilities.supportsHistoricalPlayByPlay, true);

  const archiveRequests = requests.filter((request) => request.url.includes("0022300642"));
  assert.equal(archiveRequests.length, 3);
  for (const request of archiveRequests) {
    assert.equal(request.headers.Accept, "*/*");
    assert.equal(request.headers["Accept-Language"], "en-US,en;q=0.9");
    assert.equal(request.headers.Origin, "https://www.nba.com");
    assert.equal(request.headers.Referer, "https://www.nba.com/");
    assert.equal(request.headers["Sec-Fetch-Dest"], "empty");
    assert.equal(request.headers["Sec-Fetch-Mode"], "cors");
    assert.equal(request.headers["Sec-Fetch-Site"], "same-site");
    assert.equal(request.headers.Priority, "u=4");
    assert.equal(request.headers["User-Agent"], "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0");
    assert.equal("Cookie" in request.headers, false);
    assert.equal("Host" in request.headers, false);
  }

  await assert.rejects(
    nba.getHistoricalGameEvents({ gameId: "0022300642", cursor: "invalid" }),
    (error) => error instanceof ProviderError && error.code === "INVALID_ARGUMENT",
  );
  const requestsBeforeBlankGameId = requests.length;
  await assert.rejects(
    nba.getHistoricalGameBoxScore("   "),
    (error) => error instanceof ProviderError && error.code === "INVALID_ARGUMENT",
  );
  await assert.rejects(
    nba.getHistoricalGameEvents({ gameId: "   " }),
    (error) => error instanceof ProviderError && error.code === "INVALID_ARGUMENT",
  );
  assert.equal(requests.length, requestsBeforeBlankGameId, "blank archive game IDs must not reach the upstream provider");

  const nonFinal = new NbaComProvider((input) => Promise.resolve(new Response(
    String(input).includes("boxscore_")
      ? fixtures["historical-boxscore"].replace('"gameStatus": 3', '"gameStatus": 2')
      : fixtures["historical-playbyplay"],
  )));
  await assert.rejects(
    nonFinal.getHistoricalGameEvents({ gameId: "0022300642" }),
    (error) => error instanceof ProviderError && error.code === "DATA_UNAVAILABLE",
  );
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
