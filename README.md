# nba-mcp

An [MCP](https://modelcontextprotocol.io/) server that gives AI assistants NBA scores, live game updates, box scores, rosters, and team/player search.

Ask your MCP client questions such as:

- “What NBA games are live right now?”
- “What is the score of the Lakers game?”
- “Who is leading this game in points?”
- “What happened most recently?”
- “Who is on the Boston Celtics roster?”
- “What NBA games are on this week?”

***My example of the NBA opening night in [Pi](https://github.com/earendil-works/pi) harness***

<img width="990" height="697" alt="knicks-recap" src="https://github.com/user-attachments/assets/8a4d6e11-acec-461f-9968-ddb691854634" />


## Quick start

### 1. Install and build

You need [Bun](https://bun.sh/) 1.4.3 or later.

```bash
git clone <repository-url>
cd nba-mcp
bun install
bun run build
```

### 2. Add it to your MCP client

This server communicates over standard input/output (stdio), not a web URL. Replace `/absolute/path/to/nba-mcp` below with the full path to this folder.

**Claude Desktop** — add this to its MCP configuration:

```json
{
  "mcpServers": {
    "nba-mcp": {
      "command": "bun",
      "args": ["/absolute/path/to/nba-mcp/dist/index.js"],
      "env": {
        "NBA_MCP_PROVIDER": "mock"
      }
    }
  }
}
```

**Visual Studio Code** — create `.vscode/mcp.json` (or use **MCP: Open User Configuration**):

```json
{
  "servers": {
    "nba-mcp": {
      "type": "stdio",
      "command": "bun",
      "args": ["/absolute/path/to/nba-mcp/dist/index.js"],
      "env": {
        "NBA_MCP_PROVIDER": "mock"
      }
    }
  }
}
```

`mock` provides deterministic sample data. Change it to `nba-com` in either configuration above to use current public NBA data.

Restart your client, then ask it: **“What NBA games are live right now?”** For more client setup and troubleshooting, see [MCP client configuration](docs/client-configuration.md).

## Version and update verification

`package.json` is the single source of truth for the server version. To set a new version, update its `version` field, rebuild, and restart the MCP client so it starts the new server process:

```bash
# Set the desired semantic version in package.json, then:
bun run build
```

After the client reconnects, call `get_server_capabilities`. Its `version` value must match `package.json`; this confirms that the client is connected to the rebuilt version rather than an older running process. You can also confirm the package value locally with:

```bash
bun -e 'console.log(require("./package.json").version)'
```

## Choose a data provider

Choose a provider with `NBA_MCP_PROVIDER`; see [Configuration](#configuration) for how to set environment variables.

| Provider | Best for | What to expect |
| --- | --- | --- |
| `mock` (default) | Trying the server, development, and tests | Reliable, deterministic sample data; no account or API key needed. |
| `nba-com` | Current NBA information | Public nba.com live data; no API key needed. Availability can be affected by rate limits, automated-traffic blocking, or upstream changes. |

With `nba-com`, you can access current and upcoming schedules, live game status, box scores, play-by-play, and team rosters, along with historical player and team statistics, game logs, league leaders, standings, and selected archived game data. Team search covers all 30 NBA teams; player-directory search is not available. Data is sourced from public NBA endpoints, so availability and historical coverage may change.


## What your assistant can do

| Tool | Use it for |
| --- | --- |
| `get_live_games` | Games currently in progress |
| `get_todays_games` | Scheduled, live, and final games for a date and timezone |
| `get_games_this_week` | The Monday-through-Sunday schedule for this week or a requested week |
| `get_game_status` | Score, period, and clock for one game |
| `get_game_box_score` | Team totals and player statistics |
| `get_recent_game_events` | Recent play-by-play events |
| `get_team_roster` | A team’s current roster |
| `search_teams` | Find a team ID from a name, city, or abbreviation |
| `search_players` | Find active players by name |
| `get_player_season_stats` | Traditional player statistics for a season and phase |
| `get_player_game_log` | Paginated player games for a season, with optional dates |
| `get_team_season_stats` | Traditional team statistics for a season and phase |
| `get_team_game_log` | Paginated team games for a season, with optional dates |
| `get_league_leaders` | Paginated leaders for supported traditional stat categories |
| `get_league_standings` | Final standings for a season and phase |
| `get_historical_game_box_score` | Final archived game box score (partial archive coverage) |
| `get_historical_game_events` | Paginated archived play-by-play (partial archive coverage) |
| `get_server_capabilities` | Check the active provider, supported tools, and limitations |

Live responses include freshness information. Results are cached in memory briefly to reduce repeated requests; restarting the server clears that cache.

## Configuration

All settings are optional. Copy `.env.example` to `.env.local` for local use, or provide them through your MCP client. Environment variables supplied by the client or process take precedence over `.env.local`.

```text
NBA_MCP_PROVIDER=mock
NBA_MCP_CACHE_TTL_LIVE_SECONDS=10
NBA_MCP_CACHE_TTL_ROSTER_SECONDS=86400
# Historical aggregates, standings, and final box scores (seven days).
NBA_MCP_CACHE_TTL_HISTORICAL_SECONDS=604800
# Historical game logs and play-by-play pages (one day).
NBA_MCP_CACHE_TTL_HISTORICAL_LOG_SECONDS=86400
NBA_MCP_TIMEZONE=America/New_York
```

Schedule lookups are cached for a fixed 60 seconds. `NBA_MCP_TIMEZONE` must be a valid IANA timezone such as `Europe/London`, `Asia/Tokyo`, or `America/New_York`; use it when asking for a day’s schedule so “today” matches your location.

## Run locally

```bash
bun run dev       # start from TypeScript and watch for changes
bun start         # run the built server
bun run typecheck # check types
bun run test      # build and run tests
```

When running directly, the server uses stdio. It will appear to wait for input in a terminal; connect it through an MCP client rather than opening it in a browser.

## Current limits

Historical tools cover traditional player/team season stats and game logs, league leaders and standings, plus archived game detail. NBA Stats and CDN archives are public upstream sources and can be blocked, changed, or incomplete; archived box-score and play-by-play coverage is explicitly partial. In particular, the NBA Stats `leagueleaders` endpoint can return HTML instead of JSON; in that case `get_league_leaders` returns a typed `PROVIDER_UNAVAILABLE` error rather than incomplete data. The server does not provide advanced analytics, shot charts, betting/odds, fantasy projections, or generated game recaps.

> **Unofficial project:** nba-mcp is not affiliated with, endorsed by, or sponsored by the NBA. NBA names, logos, and data may be subject to third-party rights and terms; users are responsible for complying with applicable data-provider terms.
