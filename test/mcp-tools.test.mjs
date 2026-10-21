import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createNbaMcpServer } from "../dist/mcpServer.js";

const mockConfig = {
  provider: "mock",
  cacheTtlLiveSeconds: 10,
  cacheTtlRosterSeconds: 86_400,
  cacheTtlHistoricalSeconds: 604_800,
  cacheTtlHistoricalLogSeconds: 86_400,
  timezone: "America/New_York",
};

async function createClient() {
  const server = createNbaMcpServer(mockConfig);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "nba-mcp-tool-test", version: "1.0.0" });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    async close() {
      await Promise.all([clientTransport.close(), server.close()]);
    },
  };
}

function structured(result) {
  assert.equal(result.isError, undefined, result.content?.[0]?.text);
  assert.ok(result.structuredContent, "tool result must include structuredContent");
  assert.equal(
    result.content?.[0]?.text,
    JSON.stringify(result.structuredContent, null, 2),
    "text and structured tool output must stay in sync",
  );
  return result.structuredContent;
}

test("all MCP tools expose the normalized mock-provider response contract", async (t) => {
  const connection = await createClient();
  t.after(() => connection.close());

  const listed = await connection.client.listTools();
  assert.deepEqual(
    listed.tools.map((tool) => tool.name).sort(),
    [
      "get_game_box_score",
      "get_game_status",
      "get_games_this_week",
      "get_historical_game_box_score",
      "get_historical_game_events",
      "get_league_leaders",
      "get_league_standings",
      "get_live_games",
      "get_player_game_log",
      "get_player_season_stats",
      "get_recent_game_events",
      "get_server_capabilities",
      "get_team_game_log",
      "get_team_roster",
      "get_team_season_stats",
      "get_todays_games",
      "search_players",
      "search_teams",
    ],
  );

  const capabilities = structured(await connection.client.callTool({ name: "get_server_capabilities", arguments: {} }));
  assert.equal(capabilities.serverName, "nba-mcp");
  assert.equal(capabilities.activeProvider, "mock");
  assert.equal(capabilities.providerCapabilities.supportsLiveScores, true);
  assert.equal(capabilities.providerCapabilities.supportsHistoricalBoxScores, true);

  const live = structured(await connection.client.callTool({ name: "get_live_games", arguments: {} }));
  assert.equal(live.games[0].gameId, "mock-live-001");
  assert.equal(live.games[0].homeTeam.score, 82);
  assert.equal(live.meta.cacheStatus, "miss");

  const todays = structured(await connection.client.callTool({
    name: "get_todays_games",
    arguments: { date: "2026-01-12", timezone: "America/New_York" },
  }));
  assert.equal(todays.games.length, 3);
  assert.equal(todays.games[1].status.state, "scheduled");

  const weekly = structured(await connection.client.callTool({
    name: "get_games_this_week",
    arguments: { date: "2026-01-12", timezone: "America/New_York" },
  }));
  assert.equal(weekly.startDate, "2026-01-12");
  assert.equal(weekly.endDate, "2026-01-18");
  assert.equal(weekly.games.length, 3);

  const status = structured(await connection.client.callTool({
    name: "get_game_status",
    arguments: { game_id: "mock-live-001" },
  }));
  assert.equal(status.game.status.clock, "04:18");

  const boxScore = structured(await connection.client.callTool({
    name: "get_game_box_score",
    arguments: { game_id: "mock-live-001" },
  }));
  assert.equal(boxScore.boxScore.players[0].player.fullName, "Jayson Tatum");
  assert.equal(boxScore.boxScore.players[0].points, 24);

  const events = structured(await connection.client.callTool({
    name: "get_recent_game_events",
    arguments: { game_id: "mock-live-001", limit: 2 },
  }));
  assert.equal(events.events.length, 2);
  assert.equal(events.events[0].eventId, "mock-event-003");

  const roster = structured(await connection.client.callTool({
    name: "get_team_roster",
    arguments: { team_id: "BOS" },
  }));
  assert.equal(roster.roster.team.abbreviation, "BOS");
  assert.equal(roster.roster.players[0].fullName, "Jayson Tatum");

  const teams = structured(await connection.client.callTool({
    name: "search_teams",
    arguments: { query: "boston" },
  }));
  assert.deepEqual(teams.teams.map((team) => team.abbreviation), ["BOS"]);

  const players = structured(await connection.client.callTool({
    name: "search_players",
    arguments: { query: "tatum", active_only: true, limit: 1 },
  }));
  assert.deepEqual(players.players.map((player) => player.fullName), ["Jayson Tatum"]);

  const playerSeason = structured(await connection.client.callTool({
    name: "get_player_season_stats",
    arguments: { player_id: "mock-jordan", season: "1990-91", per_mode: "Totals" },
  }));
  assert.equal(playerSeason.playerSeasonStats.stats.points, 2580);

  const playerLog = structured(await connection.client.callTool({
    name: "get_player_game_log",
    arguments: { player_id: "mock-jordan", season: "1990-91", limit: 1 },
  }));
  assert.equal(playerLog.games.length, 1);
  assert.equal(playerLog.page.hasMore, true);

  const teamSeason = structured(await connection.client.callTool({
    name: "get_team_season_stats",
    arguments: { team_id: "CHI", season: "1990-91" },
  }));
  assert.equal(teamSeason.teamSeasonStats.stats.wins, 61);

  const teamLog = structured(await connection.client.callTool({
    name: "get_team_game_log",
    arguments: { team_id: "CHI", season: "1990-91", limit: 1 },
  }));
  assert.equal(teamLog.games[0].team.id, "CHI");
  assert.equal(teamLog.games[0].stats.points, teamLog.games[0].game.homeTeam.score);

  const leaders = structured(await connection.client.callTool({
    name: "get_league_leaders",
    arguments: { season: "1990-91", stat_category: "PTS" },
  }));
  assert.equal(leaders.leaders[0].player.fullName, "Michael Jordan");

  const standings = structured(await connection.client.callTool({
    name: "get_league_standings",
    arguments: { season: "1990-91" },
  }));
  assert.equal(standings.standings[0].team.id, "CHI");

  const historicalBox = structured(await connection.client.callTool({
    name: "get_historical_game_box_score",
    arguments: { game_id: "mock-final-001" },
  }));
  assert.equal(historicalBox.historicalGame.game.gameId, "mock-final-001");
  assert.deepEqual(historicalBox.historicalGame.boxScore.teams.map((entry) => entry.team.id), ["GSW", "LAL"]);
  assert.equal(historicalBox.historicalGame.boxScore.teams[0].points, historicalBox.historicalGame.game.homeTeam.score);

  const historicalEvents = structured(await connection.client.callTool({
    name: "get_historical_game_events",
    arguments: { game_id: "mock-final-001", limit: 1 },
  }));
  assert.equal(historicalEvents.events[0].gameId, "mock-final-001");
  assert.equal(historicalEvents.events[0].teamId, "GSW");

  const notFound = await connection.client.callTool({
    name: "get_game_status",
    arguments: { game_id: "not-a-game" },
  });
  assert.equal(notFound.isError, true);
  assert.equal(notFound.structuredContent.error.code, "NOT_FOUND");
  assert.match(notFound.structuredContent.error.message, /not-a-game/);
});
