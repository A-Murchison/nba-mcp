# nba-mcp

An [MCP](https://modelcontextprotocol.io/) server that gives AI assistants NBA scores, live game updates, box scores, rosters, and team/player search.

Ask your MCP client questions such as:

- “What NBA games are live right now?”
- “What is the score of the Lakers game?”
- “Who is leading this game in points?”
- “What happened most recently?”
- “Who is on the Boston Celtics roster?”
- “What NBA games are on this week?”

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

Set `NBA_MCP_PROVIDER` in your client configuration or environment.

| Provider | Best for | What to expect |
| --- | --- | --- |
| `mock` (default) | Trying the server, development, and tests | Reliable, deterministic sample data; no account or API key needed. |
| `nba-com` | Current NBA information | Public nba.com live data; no API key needed. Availability can be affected by rate limits, automated-traffic blocking, or upstream changes. |

With `nba-com`, current and upcoming schedules, game status, box scores, play-by-play, and rosters are supported. Team search covers all 30 NBA teams. Player-directory search is not available from this provider. Current-day schedules, live-game discovery, and game status use NBA's CDN live scoreboard (`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`) first. Explicit dates and weekly schedules use the public CDN season schedule (`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`), avoiding the automated-traffic restrictions imposed by the `core-api.nba.com` gamecard feed. Box scores and play-by-play use live-data endpoints. The provider uses browser-compatible request headers for NBA CDN requests and retries a rate-limited request after the upstream's requested delay; upstream availability and the schedule's current-season coverage can still change.

> This project is not affiliated with, endorsed by, or sponsored by the NBA. You are responsible for complying with your data provider’s terms.

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
| `get_server_capabilities` | Check the active provider, supported tools, and limitations |

Live responses include freshness information. Results are cached in memory briefly to reduce repeated requests; restarting the server clears that cache.

## Configuration

All settings are optional. Copy `.env.example` to `.env.local` for local use, or provide them through your MCP client. Client-supplied environment variables take precedence.

```text
NBA_MCP_PROVIDER=mock
NBA_MCP_CACHE_TTL_LIVE_SECONDS=10
NBA_MCP_CACHE_TTL_ROSTER_SECONDS=86400
# Reserved for the staged historical-data release; no historical tools are exposed yet.
NBA_MCP_CACHE_TTL_HISTORICAL_SECONDS=604800
NBA_MCP_CACHE_TTL_HISTORICAL_LOG_SECONDS=86400
NBA_MCP_TIMEZONE=America/New_York
NBA_MCP_LOG_LEVEL=info
```

`NBA_MCP_TIMEZONE` accepts an IANA timezone such as `Europe/London`, `Asia/Tokyo`, or `America/New_York`. Use it when asking for a day’s schedule so “today” matches your location.

## Run locally

```bash
bun run dev       # start from TypeScript and watch for changes
bun start         # run the built server
bun run typecheck # check types
bun run test      # build and run tests
```

When running directly, the server uses stdio. It will appear to wait for input in a terminal; connect it through an MCP client rather than opening it in a browser.

## Current limits

This server focuses on current and live NBA information. It does not provide historical box scores, long-term player game logs, advanced analytics, shot charts, or generated game recaps.
