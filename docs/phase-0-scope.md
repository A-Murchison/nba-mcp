# Phase 0 Scope and Architecture

## v0.1 product scope

`nba-mcp` is live-first. Version 0.1 is intended to help MCP clients answer: **What is happening in the NBA right now?**

### Included tools

- `get_server_capabilities`
- `get_live_games`
- `get_todays_games`
- `get_game_status`
- `get_game_box_score`
- `get_recent_game_events`
- `get_team_roster`
- `search_teams`
- `search_players`

### Explicitly deferred

- Historical box scores
- Long-term player game logs
- Advanced analytics
- Betting and odds
- Fantasy projections
- Shot charts
- Heavy recap generation

These can be added later only when they support reliable live or current-season context.

## Architecture

```text
MCP client
  -> MCP tools
  -> domain services
  -> DataProvider interface
      -> MockProvider
      -> NbaComProvider (planned)
  -> canonical models
  -> cache/freshness metadata
```

The MCP layer must not call upstream data sources directly. Tools call domain services, and services call `DataProvider` implementations. Providers normalize upstream responses into canonical internal models before the tools return data.

## Provider strategy

The project is provider-agnostic from day one.

### Mock provider

- Ships with the repository.
- Requires no API key.
- Used for tests, demos, CI, and local development.
- Will include realistic hand-authored sample games, box scores, rosters, and play-by-play in a later phase.

### Real provider

- The first real provider adapter is planned around nba.com live data, if legally acceptable.
- Users are responsible for complying with their configured provider's terms.
- Real provider adapters must implement the same `DataProvider` interface and return canonical models.

## Provider capabilities

Every provider declares what it can actually support:

```json
{
  "supportsLiveScores": true,
  "supportsLiveBoxScores": true,
  "supportsPlayByPlay": false,
  "supportsCurrentRosters": true,
  "supportsInjuries": false,
  "supportsHistoricalStats": false,
  "updateFrequencySeconds": 10
}
```

Tools must use these capabilities to return clear `UNSUPPORTED_CAPABILITY` or `DATA_UNAVAILABLE` errors instead of pretending data exists.

## Error format

All tool errors should use the same shape:

```json
{
  "error": {
    "code": "DATA_UNAVAILABLE",
    "message": "Live play-by-play is not available from the configured provider.",
    "suggestedAlternatives": ["Use get_game_box_score", "Use get_game_status"]
  }
}
```

Core error codes are defined in `src/domain/errors.ts`.
