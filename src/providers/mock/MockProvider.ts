import type { ProviderCapabilities } from "../../domain/capabilities.js";
import type {
  BoxScore,
  Game,
  GameBoxScoreResponse,
  GameStatusResponse,
  LiveGame,
  LiveGamesResponse,
  Player,
  PlayByPlayEvent,
  RecentGameEventsResponse,
  ResponseMetadata,
  SearchPlayersResponse,
  SearchTeamsResponse,
  Team,
  TeamRosterResponse,
  TodaysGamesResponse,
} from "../../domain/models.js";
import type {
  DataProvider,
  GetRecentGameEventsInput,
  GetTodaysGamesInput,
  SearchPlayersInput,
} from "../DataProvider.js";
import { ProviderError } from "../ProviderError.js";

const generatedAt = new Date().toISOString();

const teams: Team[] = [
  {
    id: "BOS",
    abbreviation: "BOS",
    name: "Boston Celtics",
    city: "Boston",
    conference: "Eastern",
    division: "Atlantic",
  },
  {
    id: "DEN",
    abbreviation: "DEN",
    name: "Denver Nuggets",
    city: "Denver",
    conference: "Western",
    division: "Northwest",
  },
  {
    id: "LAL",
    abbreviation: "LAL",
    name: "Los Angeles Lakers",
    city: "Los Angeles",
    conference: "Western",
    division: "Pacific",
  },
  {
    id: "GSW",
    abbreviation: "GSW",
    name: "Golden State Warriors",
    city: "San Francisco",
    conference: "Western",
    division: "Pacific",
  },
];

const players: Player[] = [
  { id: "mock-tatum", fullName: "Jayson Tatum", firstName: "Jayson", lastName: "Tatum", teamId: "BOS", position: "F", jerseyNumber: "0", active: true, height: "6-8", weight: "210" },
  { id: "mock-brown", fullName: "Jaylen Brown", firstName: "Jaylen", lastName: "Brown", teamId: "BOS", position: "G-F", jerseyNumber: "7", active: true, height: "6-6", weight: "223" },
  { id: "mock-jokic", fullName: "Nikola Jokic", firstName: "Nikola", lastName: "Jokic", teamId: "DEN", position: "C", jerseyNumber: "15", active: true, height: "6-11", weight: "284" },
  { id: "mock-murray", fullName: "Jamal Murray", firstName: "Jamal", lastName: "Murray", teamId: "DEN", position: "G", jerseyNumber: "27", active: true, height: "6-4", weight: "215" },
  { id: "mock-lebron", fullName: "LeBron James", firstName: "LeBron", lastName: "James", teamId: "LAL", position: "F", jerseyNumber: "23", active: true, height: "6-9", weight: "250" },
  { id: "mock-curry", fullName: "Stephen Curry", firstName: "Stephen", lastName: "Curry", teamId: "GSW", position: "G", jerseyNumber: "30", active: true, height: "6-2", weight: "185" },
];

const liveGame: LiveGame = {
  gameId: "mock-live-001",
  date: "2026-01-12",
  venue: "TD Garden",
  status: {
    state: "in_progress",
    period: 3,
    clock: "04:18",
    statusText: "Q3 04:18",
    possessionTeamId: "BOS",
  },
  homeTeam: { ...teams[0]!, score: 82 },
  awayTeam: { ...teams[1]!, score: 78 },
};

const scheduledGame: Game = {
  gameId: "mock-scheduled-001",
  date: "2026-01-12",
  venue: "Crypto.com Arena",
  status: {
    state: "scheduled",
    period: 0,
    statusText: "Scheduled 10:00 PM ET",
    startsAt: "2026-01-13T03:00:00Z",
  },
  homeTeam: teams[2]!,
  awayTeam: teams[3]!,
};

const finalGame: Game = {
  gameId: "mock-final-001",
  date: "2026-01-12",
  venue: "Chase Center",
  status: {
    state: "final",
    period: 4,
    statusText: "Final",
  },
  homeTeam: { ...teams[3]!, score: 111 },
  awayTeam: { ...teams[2]!, score: 104 },
};

const boxScore: BoxScore = {
  gameId: liveGame.gameId,
  status: liveGame.status,
  teams: [
    { team: teams[0]!, points: 82, rebounds: 32, assists: 21, steals: 5, blocks: 4, turnovers: 8, fieldGoalsMade: 31, fieldGoalsAttempted: 67, threePointersMade: 11, threePointersAttempted: 29, freeThrowsMade: 9, freeThrowsAttempted: 12 },
    { team: teams[1]!, points: 78, rebounds: 35, assists: 20, steals: 4, blocks: 3, turnovers: 10, fieldGoalsMade: 30, fieldGoalsAttempted: 66, threePointersMade: 8, threePointersAttempted: 25, freeThrowsMade: 10, freeThrowsAttempted: 14 },
  ],
  players: [
    { player: players[0]!, teamId: "BOS", starter: true, played: true, minutes: "27:34", points: 24, rebounds: 7, assists: 4, steals: 1, blocks: 1, turnovers: 2, fieldGoalsMade: 9, fieldGoalsAttempted: 17, threePointersMade: 3, threePointersAttempted: 8, freeThrowsMade: 3, freeThrowsAttempted: 4, plusMinus: 8 },
    { player: players[1]!, teamId: "BOS", starter: true, played: true, minutes: "25:11", points: 18, rebounds: 4, assists: 3, steals: 2, turnovers: 1, fieldGoalsMade: 7, fieldGoalsAttempted: 13, threePointersMade: 2, threePointersAttempted: 5, freeThrowsMade: 2, freeThrowsAttempted: 2, plusMinus: 5 },
    { player: players[2]!, teamId: "DEN", starter: true, played: true, minutes: "29:02", points: 22, rebounds: 12, assists: 8, steals: 1, blocks: 1, turnovers: 3, fieldGoalsMade: 10, fieldGoalsAttempted: 16, threePointersMade: 1, threePointersAttempted: 3, freeThrowsMade: 1, freeThrowsAttempted: 2, plusMinus: -3 },
    { player: players[3]!, teamId: "DEN", starter: true, played: true, minutes: "26:48", points: 19, rebounds: 3, assists: 5, turnovers: 2, fieldGoalsMade: 7, fieldGoalsAttempted: 15, threePointersMade: 3, threePointersAttempted: 7, freeThrowsMade: 2, freeThrowsAttempted: 2, plusMinus: -6 },
  ],
};

const events: PlayByPlayEvent[] = [
  { eventId: "mock-event-003", gameId: liveGame.gameId, period: 3, clock: "04:18", sequenceNumber: 3, teamId: "BOS", playerId: "mock-tatum", eventType: "made_shot", description: "Jayson Tatum makes 3-foot driving layup", scoreHome: 82, scoreAway: 78, occurredAt: generatedAt },
  { eventId: "mock-event-002", gameId: liveGame.gameId, period: 3, clock: "04:45", sequenceNumber: 2, teamId: "DEN", playerId: "mock-jokic", eventType: "rebound", description: "Nikola Jokic defensive rebound", scoreHome: 80, scoreAway: 78, occurredAt: generatedAt },
  { eventId: "mock-event-001", gameId: liveGame.gameId, period: 3, clock: "05:02", sequenceNumber: 1, teamId: "DEN", playerId: "mock-murray", eventType: "made_shot", description: "Jamal Murray makes 26-foot three point jumper", scoreHome: 80, scoreAway: 78, occurredAt: generatedAt },
];

function metadata(source: string, isLive: boolean): ResponseMetadata {
  const nowMs = Date.now();
  const lastUpdatedMs = Date.parse(generatedAt);

  return {
    source,
    lastUpdated: generatedAt,
    dataFreshnessSeconds: Math.max(0, Math.floor((nowMs - lastUpdatedMs) / 1000)),
    isLive,
    cacheStatus: "bypass",
    providerLatencyMs: 0,
  };
}

function includesQuery(value: string, query: string): boolean {
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

/**
 * Mock provider returning normalized canonical data.
 *
 * The data is intentionally small and hand-authored so the repository can run
 * without API keys or proprietary NBA data dumps.
 */
export class MockProvider implements DataProvider {
  readonly name = "mock";

  readonly capabilities: ProviderCapabilities = {
    supportsLiveScores: true,
    supportsLiveBoxScores: true,
    supportsPlayByPlay: true,
    supportsCurrentRosters: true,
    supportsInjuries: false,
    supportsHistoricalStats: false,
    updateFrequencySeconds: 10,
  };

  async getLiveGames(): Promise<LiveGamesResponse> {
    return { games: [liveGame], meta: metadata(this.name, true) };
  }

  async getTodaysGames(input: GetTodaysGamesInput = {}): Promise<TodaysGamesResponse> {
    return {
      date: input.date ?? liveGame.date,
      timezone: input.timezone ?? "America/New_York",
      games: [liveGame, scheduledGame, finalGame],
      meta: metadata(this.name, true),
    };
  }

  async getGameStatus(gameId: string): Promise<GameStatusResponse> {
    const game = [liveGame, scheduledGame, finalGame].find((candidate) => candidate.gameId === gameId);
    if (!game) throw new ProviderError("NOT_FOUND", `Game '${gameId}' was not found in mock data.`);
    return { game, meta: metadata(this.name, game.status.state === "in_progress" || game.status.state === "halftime") };
  }

  async getGameBoxScore(gameId: string): Promise<GameBoxScoreResponse> {
    if (![liveGame, scheduledGame, finalGame].some((game) => game.gameId === gameId)) {
      throw new ProviderError("NOT_FOUND", `Game '${gameId}' was not found in mock data.`);
    }
    if (gameId !== boxScore.gameId) {
      throw new ProviderError("DATA_UNAVAILABLE", `A box score is not available for mock game '${gameId}'.`, {
        suggestedAlternatives: ["Use get_game_status", "Use get_todays_games"],
      });
    }
    return { boxScore, meta: metadata(this.name, true) };
  }

  async getRecentGameEvents(input: GetRecentGameEventsInput): Promise<RecentGameEventsResponse> {
    if (![liveGame, scheduledGame, finalGame].some((game) => game.gameId === input.gameId)) {
      throw new ProviderError("NOT_FOUND", `Game '${input.gameId}' was not found in mock data.`);
    }
    if (input.gameId !== liveGame.gameId) {
      throw new ProviderError("DATA_UNAVAILABLE", `Play-by-play is not available for mock game '${input.gameId}'.`, {
        suggestedAlternatives: ["Use get_game_status", "Use get_todays_games"],
      });
    }
    return {
      gameId: input.gameId,
      events: events.slice(0, input.limit ?? 10),
      meta: metadata(this.name, true),
    };
  }

  async getTeamRoster(teamId: string): Promise<TeamRosterResponse> {
    const team = teams.find((candidate) => candidate.id === teamId);
    if (!team) throw new ProviderError("NOT_FOUND", `Team '${teamId}' was not found in mock data.`);
    return {
      roster: {
        team,
        players: players.filter((player) => player.teamId === team.id),
        season: "2025-26",
      },
      meta: metadata(this.name, false),
    };
  }

  async searchTeams(query: string): Promise<SearchTeamsResponse> {
    return {
      query,
      teams: teams.filter((team) =>
        [team.id, team.abbreviation, team.name, team.city ?? ""].some((value) => includesQuery(value, query)),
      ),
      meta: metadata(this.name, false),
    };
  }

  async searchPlayers(input: SearchPlayersInput): Promise<SearchPlayersResponse> {
    const limit = input.limit ?? 10;
    return {
      query: input.query,
      players: players
        .filter((player) => (input.activeOnly === false ? true : player.active))
        .filter((player) => includesQuery(player.fullName, input.query))
        .slice(0, limit),
      meta: metadata(this.name, false),
    };
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return this.capabilities;
  }
}
