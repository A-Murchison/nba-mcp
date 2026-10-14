# nba-mcp

A live-first, provider-agnostic NBA stats MCP server.

The goal is to help AI clients answer questions like:

- What NBA games are live right now?
- What is the score of a specific game?
- Who is leading a live game in points, rebounds, or assists?
- What just happened in a game?
- Who is on a team's current roster?
- Which players or teams match this query?

## Status

Phases 1–3 are implemented: the stdio MCP server registers all v0.1 tools, routes them through the provider abstraction, and applies an in-memory cache with request coalescing. The mock provider is the default, so the server works without API keys.

The foundations include scope, TypeScript scaffold, provider contract, capability model, canonical live data models, freshness metadata, structured error types, normalized mock provider responses, configuration, and initial docs.

## v0.1 tool scope

Included in v0.1:

- `get_server_capabilities`
- `get_live_games`
- `get_todays_games`
- `get_game_status`
- `get_game_box_score`
- `get_recent_game_events`
- `get_team_roster`
- `search_teams`
- `search_players`

Deferred until later:

- Historical box scores
- Long-term player game logs
- Advanced analytics
- Betting/odds
- Fantasy projections
- Shot charts
- Heavy recap generation

## Architecture

```text
MCP tools
  -> domain services
  -> DataProvider interface
      -> MockProvider
      -> NbaComProvider (planned)
  -> canonical models
  -> cache/freshness metadata
```

Providers must declare capabilities so the server can clearly report unavailable data instead of guessing. Provider methods return canonical internal models with `meta` freshness data instead of raw upstream payloads.

## Caching

The server caches responses in memory and coalesces concurrent identical requests so only one provider call is made. Live games, game status, box scores, and recent events use `NBA_MCP_CACHE_TTL_LIVE_SECONDS`. Rosters and team/player search use `NBA_MCP_CACHE_TTL_ROSTER_SECONDS`; today's schedule uses a fixed 60-second TTL. Responses set `meta.cacheStatus` to `miss` when fetched from a provider and `hit` when served from the cache. Cache contents are process-local and cleared when the server restarts.

## Configuration

Copy `.env.example` and adjust as needed:

```text
NBA_MCP_PROVIDER=mock
NBA_MCP_API_KEY=
NBA_MCP_CACHE_TTL_LIVE_SECONDS=10
NBA_MCP_CACHE_TTL_ROSTER_SECONDS=86400
NBA_MCP_TIMEZONE=America/New_York
NBA_MCP_LOG_LEVEL=info
```

## Development

```bash
npm install
npm run typecheck
npm run build
npm start
```

`npm start` launches the MCP server over stdio. For local development without building first, use:

```bash
npm run dev
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "nba-mcp": {
      "command": "node",
      "args": ["/path/to/nba-mcp/dist/index.js"],
      "env": {
        "NBA_MCP_PROVIDER": "mock"
      }
    }
  }
}
```

## Tools

- `get_server_capabilities` — server version, active provider, supported tools, provider capabilities, update frequency, and limitations
- `get_live_games` — currently live games with score/status/freshness metadata
- `get_todays_games` — scheduled, live, and final games for a date/timezone
- `get_game_status` — lightweight status for a single game
- `get_game_box_score` — team totals and player box score stats
- `get_recent_game_events` — recent play-by-play events when provider-supported
- `get_team_roster` — current roster for a team
- `search_teams` — resolve team names/cities/abbreviations to canonical team IDs
- `search_players` — resolve current players by name

## Legal/provider disclaimer

This project is not affiliated with, endorsed by, or sponsored by the NBA.

Users are responsible for complying with the terms of their configured data provider. This repository should not include proprietary live data dumps or large unlicensed historical datasets.

## More docs

- [Phase 0 Scope and Architecture](docs/phase-0-scope.md)
- [Phase 1 Canonical Live Data Models](docs/phase-1-models.md)
