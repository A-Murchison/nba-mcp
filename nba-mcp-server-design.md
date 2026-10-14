# Open Source MCP Server Design: Live NBA Stats

## 1. Project Goal

Build an open source MCP server that gives AI clients structured, reliable access to NBA data:

- Live games
- Box scores
- Play-by-play
- Team/player stats
- Schedules
- Standings
- Injury/status info, if available
- Historical lookups
- Natural-language-friendly summaries and comparisons

The server should be useful for:

- Fans
- Fantasy basketball users
- Sports writers
- Developers building NBA bots
- AI assistants that need current NBA context
- Analytics hobbyists

It should not merely expose raw API endpoints. A good MCP server should provide **LLM-friendly tools, resources, and prompts** that make it easy for models to answer useful basketball questions accurately.

---

## 2. Key Design Principles

### 2.1 MCP-native, not just API-wrapped

Bad MCP server:

```text
call_api(endpoint, params)
```

Good MCP server:

```text
get_live_games()
get_game_box_score(game_id)
get_player_recent_games(player_id, limit)
summarize_game(game_id)
compare_players(player_ids, timeframe)
get_team_schedule(team_id, date_range)
```

The MCP interface should model actual user intent.

### 2.2 Prefer structured facts over prose

The server should return structured, machine-readable objects with clear metadata.

Example:

```json
{
  "game_id": "0022400312",
  "status": "in_progress",
  "period": 3,
  "clock": "04:18",
  "home_team": {
    "id": "LAL",
    "name": "Los Angeles Lakers",
    "score": 82
  },
  "away_team": {
    "id": "DEN",
    "name": "Denver Nuggets",
    "score": 78
  },
  "last_updated": "2026-01-12T02:14:33Z",
  "data_freshness_seconds": 9,
  "source": "configured_provider"
}
```

LLMs can write summaries, but they need facts first.

### 2.3 Always expose freshness metadata

Live sports data becomes stale quickly. Every response should include:

- `last_updated`
- `source`
- `data_freshness_seconds`
- `is_live`
- `cache_status`
- possibly `provider_latency_ms`

This is critical for trust.

### 2.4 Avoid pretending to have data

If data is unavailable, delayed, licensed, or unsupported, the server should say so clearly.

Example:

```json
{
  "error": {
    "code": "DATA_UNAVAILABLE",
    "message": "Live play-by-play is not available from the configured provider.",
    "suggested_alternatives": [
      "Use get_game_box_score",
      "Configure a provider that supports live play-by-play"
    ]
  }
}
```

### 2.5 Provider-agnostic architecture

The OSS project should not be tightly coupled to a single data source.

You likely want provider adapters such as:

```text
DataProvider
  get_live_games()
  get_schedule()
  get_box_score(game_id)
  get_play_by_play(game_id)
  get_player_profile(player_id)
  get_team_roster(team_id)
  get_standings()
```

Then the project can support:

- Free/community data sources
- Paid commercial APIs
- Self-hosted historical data
- Mock/demo provider
- Cached file-based provider for testing

This is important for legal, licensing, reliability, and contributor flexibility.

---

## 3. Major Components

### 3.1 MCP Interface Layer

This is the layer exposed to MCP clients.

It defines:

- Tools
- Resources
- Prompts
- Error format
- Capability metadata
- Server info

The MCP layer should not know provider-specific details. It calls domain services.

### 3.2 Domain Service Layer

This layer contains basketball-specific logic.

Examples:

- Normalizing team names
- Mapping player IDs
- Computing recent averages
- Comparing stat lines
- Ranking players
- Building game summaries
- Detecting lead changes
- Identifying top performers
- Handling live game state

Example services:

```text
GameService
PlayerService
TeamService
ScheduleService
StandingsService
StatsService
SearchService
SummaryService
FantasyService optional
```

### 3.3 Provider Adapter Layer

This abstracts external data sources.

Each provider implements a common interface.

Example:

```text
ProviderAdapter
  name
  capabilities
  rate_limits
  get_live_scoreboard()
  get_game_summary(game_id)
  get_box_score(game_id)
  get_play_by_play(game_id)
  get_player_stats(player_id, options)
  search_players(query)
  search_teams(query)
```

Providers should declare capabilities:

```json
{
  "supports_live_scores": true,
  "supports_play_by_play": true,
  "supports_shot_charts": false,
  "supports_injuries": false,
  "supports_odds": false,
  "supports_historical_stats": true,
  "update_frequency_seconds": 10
}
```

This lets tools degrade gracefully.

### 3.4 Cache Layer

Live stats can be rate-limited and expensive. The cache is essential.

Cache categories:

| Data Type | Suggested TTL |
|---|---:|
| Live scoreboard | 5-15 seconds |
| Live box score | 5-15 seconds |
| Play-by-play | 5-15 seconds |
| Schedule | 5-60 minutes |
| Standings | 5-30 minutes |
| Rosters | 1-24 hours |
| Player profiles | 1-7 days |
| Historical box scores | indefinite or long TTL |

The cache should support:

- Memory cache for simple deployments
- Optional persistent cache
- Provider-specific caching
- Request coalescing
- Stale-while-revalidate
- Cache metadata in responses

### 3.5 Normalization Layer

Different providers will name fields differently.

The project should define canonical internal models:

```text
Team
Player
Game
GameStatus
BoxScore
PlayerBoxScore
TeamBoxScore
PlayByPlayEvent
ShotEvent
Standing
ScheduleEntry
InjuryStatus
```

This is one of the most important pieces.

If normalization is weak, the MCP tools become inconsistent and annoying.

### 3.6 Search and Resolution Layer

Users and LLMs will ask for:

- “Lakers”
- “LA Lakers”
- “Los Angeles”
- “LeBron”
- “Jokic”
- “Nikola Jokić”
- “OKC”
- “Thunder”

The MCP server should expose search/resolution tools:

- `search_players`
- `search_teams`
- `resolve_player`
- `resolve_team`
- `resolve_game`

A good MCP server should help the model find IDs reliably.

---

## 4. Proposed MCP Tools

### 4.1 Server/Metadata Tools

#### `get_server_capabilities`

Returns configured providers, supported features, freshness info, and limitations.

Useful for AI clients to know what they can ask.

Returns:

```json
{
  "server_name": "nba-mcp",
  "version": "0.1.0",
  "providers": [
    {
      "name": "example_provider",
      "capabilities": {
        "live_scores": true,
        "box_scores": true,
        "play_by_play": true,
        "injuries": false,
        "odds": false
      }
    }
  ]
}
```

### 4.2 Discovery Tools

#### `search_players`

Inputs:

```json
{
  "query": "jokic",
  "active_only": true,
  "limit": 10
}
```

Returns matching players with IDs, team, position, status.

#### `search_teams`

Inputs:

```json
{
  "query": "lakers"
}
```

Returns canonical team records.

#### `get_todays_games`

Inputs:

```json
{
  "date": "2026-01-12",
  "timezone": "America/New_York"
}
```

If no date is provided, defaults to today.

#### `resolve_game`

Inputs:

```json
{
  "team": "Lakers",
  "date": "today"
}
```

Useful when the model needs to find a game ID.

### 4.3 Live Game Tools

#### `get_live_games`

Returns all live games with score, period, clock, and status.

#### `get_game_status`

Inputs:

```json
{
  "game_id": "0022400312"
}
```

Returns:

- Scheduled/in-progress/final
- Period
- Clock
- Score
- Possession if available
- Last updated

#### `get_game_box_score`

Inputs:

```json
{
  "game_id": "0022400312"
}
```

Returns team and player stats.

#### `get_game_play_by_play`

Inputs:

```json
{
  "game_id": "0022400312",
  "period": 4,
  "limit": 50
}
```

Should support filtering by period and maybe since event ID.

#### `get_recent_game_events`

Inputs:

```json
{
  "game_id": "0022400312",
  "limit": 10
}
```

Useful for:

> “What just happened?”

#### `get_game_leaders`

Inputs:

```json
{
  "game_id": "0022400312",
  "categories": ["points", "rebounds", "assists"]
}
```

Returns current/statistical leaders.

### 4.4 Schedule and Standings Tools

#### `get_schedule`

Inputs:

```json
{
  "team_id": "LAL",
  "start_date": "2026-01-01",
  "end_date": "2026-01-31"
}
```

#### `get_standings`

Inputs:

```json
{
  "conference": "west"
}
```

Should support:

- League standings
- Conference
- Division

#### `get_team_record`

Inputs:

```json
{
  "team_id": "DEN"
}
```

Could include:

- Overall
- Home
- Away
- Last 10
- Streak
- Conference record

### 4.5 Player Tools

#### `get_player_profile`

Inputs:

```json
{
  "player_id": "203999"
}
```

Returns bio, team, jersey, position, height, etc. depending on provider support.

#### `get_player_game_log`

Inputs:

```json
{
  "player_id": "203999",
  "season": "2025-26",
  "limit": 10
}
```

#### `get_player_recent_stats`

Inputs:

```json
{
  "player_id": "203999",
  "last_n_games": 10
}
```

Returns averages and totals.

#### `compare_players`

Inputs:

```json
{
  "player_ids": ["203999", "1629029"],
  "timeframe": {
    "type": "last_n_games",
    "value": 10
  },
  "stats": ["points", "rebounds", "assists", "fg_pct", "minutes"]
}
```

This is highly useful for fantasy and sports discussion.

### 4.6 Team Tools

#### `get_team_roster`

Inputs:

```json
{
  "team_id": "BOS"
}
```

#### `get_team_recent_games`

Inputs:

```json
{
  "team_id": "BOS",
  "limit": 10
}
```

#### `get_team_stats`

Inputs:

```json
{
  "team_id": "BOS",
  "season": "2025-26"
}
```

#### `compare_teams`

Inputs:

```json
{
  "team_ids": ["BOS", "MIL"],
  "stats": ["points_per_game", "def_rating", "pace", "net_rating"]
}
```

### 4.7 Summary/Analysis Tools

These are where the server becomes more useful than a raw API.

#### `summarize_game`

Inputs:

```json
{
  "game_id": "0022400312",
  "style": "brief"
}
```

Returns structured summary:

```json
{
  "summary": "The Lakers lead the Nuggets 82-78 midway through the third quarter...",
  "top_performers": [],
  "key_runs": [],
  "recent_events": [],
  "notable_context": [],
  "last_updated": "..."
}
```

Important: summaries should be generated from facts deterministically where possible, not hallucinated.

#### `get_game_context`

Inputs:

```json
{
  "game_id": "0022400312"
}
```

Returns:

- Score
- Status
- Team records
- Injuries if available
- Recent form
- Head-to-head if available
- Players to watch

Useful for preview or in-game context.

#### `get_player_trend`

Inputs:

```json
{
  "player_id": "203999",
  "metric": "points",
  "window": 10
}
```

Returns:

- Recent average
- Season average
- Difference
- Direction
- Game log

### 4.8 Optional Fantasy-Focused Tools

These may be phase two, but they are valuable.

#### `get_fantasy_relevant_players`

Inputs:

```json
{
  "date": "today",
  "criteria": ["high_minutes", "injury_opportunity", "hot_streak"]
}
```

#### `get_player_availability`

Inputs:

```json
{
  "player_id": "203999"
}
```

This depends heavily on provider support.

#### `get_injury_report`

Inputs:

```json
{
  "team_id": "PHX"
}
```

Must include source and timestamp.

### 4.9 Optional Betting/Odds Tools

Keep betting/odds out of the initial core unless you have a licensed source.

If included, isolate it behind a separate provider/capability flag:

- `get_game_odds`
- `get_player_props`
- `get_line_movement`

Also include legal disclaimers and disable by default.

---

## 5. MCP Resources

MCP resources are useful for stable data that can be browsed.

Potential resources:

```text
nba://teams
nba://teams/{team_id}
nba://players/{player_id}
nba://games/today
nba://games/{game_id}
nba://standings
nba://schedule/{date}
```

Examples:

### `nba://teams`

Returns all current NBA teams.

### `nba://games/today`

Returns today’s game slate.

### `nba://games/{game_id}`

Returns status, teams, score, and links to box score/play-by-play tools.

---

## 6. MCP Prompts

Prompts are a good way to make the server immediately useful in AI clients.

Suggested prompts:

### `live_scoreboard_summary`

Prompt:

> Summarize all NBA games currently live. Highlight close games, top performers, and any games in the final five minutes.

Inputs:

```json
{
  "timezone": "America/New_York"
}
```

### `game_recap`

Prompt:

> Write a game recap using box score, play-by-play, and top performers.

Inputs:

```json
{
  "game_id": "..."
}
```

### `fantasy_player_check`

Prompt:

> Analyze whether a player is trending up or down based on recent games, minutes, usage indicators, and availability.

Inputs:

```json
{
  "player_name": "..."
}
```

### `compare_players_for_fantasy`

Inputs:

```json
{
  "player_a": "...",
  "player_b": "...",
  "timeframe": "last_10_games"
}
```

### `what_just_happened`

Inputs:

```json
{
  "game_id": "..."
}
```

Uses recent events and game status.

---

## 7. Canonical Data Models

### 7.1 Team

```json
{
  "id": "LAL",
  "provider_ids": {
    "provider_a": "1610612747"
  },
  "name": "Los Angeles Lakers",
  "abbreviation": "LAL",
  "city": "Los Angeles",
  "conference": "West",
  "division": "Pacific"
}
```

### 7.2 Player

```json
{
  "id": "203999",
  "provider_ids": {},
  "full_name": "Nikola Jokić",
  "first_name": "Nikola",
  "last_name": "Jokić",
  "team_id": "DEN",
  "position": "C",
  "jersey": "15",
  "active": true
}
```

### 7.3 Game

```json
{
  "id": "0022400312",
  "date": "2026-01-12",
  "status": "in_progress",
  "season": "2025-26",
  "home_team_id": "LAL",
  "away_team_id": "DEN",
  "home_score": 82,
  "away_score": 78,
  "period": 3,
  "clock": "04:18"
}
```

### 7.4 Player Box Score

```json
{
  "player_id": "203999",
  "team_id": "DEN",
  "minutes": "31:24",
  "points": 28,
  "rebounds": 12,
  "assists": 9,
  "steals": 1,
  "blocks": 0,
  "turnovers": 3,
  "fgm": 11,
  "fga": 18,
  "fg_pct": 0.611,
  "three_pm": 2,
  "three_pa": 4,
  "ftm": 4,
  "fta": 5,
  "plus_minus": 6
}
```

### 7.5 Play-By-Play Event

```json
{
  "event_id": "345",
  "game_id": "0022400312",
  "period": 4,
  "clock": "02:31",
  "event_type": "made_shot",
  "team_id": "LAL",
  "player_id": "2544",
  "description": "LeBron James makes 3-point jump shot",
  "home_score": 101,
  "away_score": 98,
  "order": 345
}
```

---

## 8. Error Handling Design

Use consistent error objects.

```json
{
  "error": {
    "code": "PROVIDER_RATE_LIMITED",
    "message": "The configured NBA data provider rate limit was exceeded.",
    "retry_after_seconds": 30,
    "provider": "example_provider"
  }
}
```

Suggested error codes:

```text
INVALID_ARGUMENT
NOT_FOUND
AMBIGUOUS_QUERY
DATA_UNAVAILABLE
PROVIDER_UNAVAILABLE
PROVIDER_RATE_LIMITED
UNSUPPORTED_CAPABILITY
AUTH_REQUIRED
CACHE_MISS
INTERNAL_ERROR
```

For ambiguous queries:

```json
{
  "error": {
    "code": "AMBIGUOUS_QUERY",
    "message": "Multiple players matched 'Jalen Williams'.",
    "candidates": [
      {
        "player_id": "...",
        "name": "Jalen Williams",
        "team": "OKC"
      },
      {
        "player_id": "...",
        "name": "Jaylin Williams",
        "team": "OKC"
      }
    ]
  }
}
```

This is very important for sports data.

---

## 9. Configuration

The server should support configuration through environment variables and/or a config file.

Examples:

```text
NBA_MCP_PROVIDER=provider_name
NBA_MCP_API_KEY=...
NBA_MCP_CACHE_TTL_LIVE_SECONDS=10
NBA_MCP_CACHE_TTL_STATIC_SECONDS=86400
NBA_MCP_ENABLE_ODDS=false
NBA_MCP_ENABLE_INJURIES=true
NBA_MCP_TIMEZONE=America/New_York
NBA_MCP_LOG_LEVEL=info
NBA_MCP_RATE_LIMIT_PER_MINUTE=60
```

For OSS, provide:

- `.env.example`
- `config.example`
- provider setup docs

---

## 10. Provider Strategy

This is a huge decision.

You should support at least three provider modes:

### 10.1 Demo/mock provider

Ships with the repo.

Benefits:

- People can try the MCP server immediately
- Tests can run without API keys
- CI works
- Documentation screenshots/examples work

This provider can return static example games and fake live timestamps.

### 10.2 Community/free provider

A free provider option makes the project accessible.

But you need to be careful:

- Terms of service
- Rate limits
- Stability
- Redistribution rights
- Scraping policies

The project should not encourage illegal scraping.

### 10.3 Commercial provider adapter

Let users bring their own keys for licensed data.

This makes the project more legitimate.

The OSS project can define the adapter interface and include examples.

---

## 11. Legal and Licensing Considerations

This matters a lot for an NBA stats server.

### 11.1 Do not ship proprietary data

The repository should not include large datasets that violate data rights.

Okay:

- Team metadata
- Small mock data
- Schema examples
- Test fixtures if licensed/created manually

Risky:

- Live NBA feed dumps
- Full historical databases from unlicensed sources
- Redistributing paid provider data

### 11.2 Be clear that users configure their own provider

The README should say:

> This project is an MCP server framework for accessing NBA data through configured data providers. Users are responsible for complying with the terms of their chosen provider.

### 11.3 Avoid NBA branding confusion

Name should avoid implying official affiliation.

Possible names:

- `hoops-mcp`
- `basketball-stats-mcp`
- `nba-live-mcp`
- `court-mcp`

Include disclaimer:

> This project is not affiliated with, endorsed by, or sponsored by the NBA.

---

## 12. Security Model

Even if this is “just sports data,” treat it seriously.

### 12.1 API key safety

- Never expose provider API keys in tool responses
- Redact secrets in logs
- Support env vars
- Do not commit `.env`

### 12.2 Input validation

Validate:

- Dates
- Team IDs
- Player IDs
- Limits
- Time ranges
- Sort fields
- Metric names

### 12.3 Rate limiting

Optional but recommended, especially if running a hosted public instance.

Implement:

- Per-client rate limit
- Provider rate protection
- Cache-first responses

### 12.4 No arbitrary URL fetch tool

Do not expose a generic `fetch_url` or `query_provider_raw` tool by default. That increases abuse risk and breaks abstraction.

---

## 13. Observability

For a serious OSS MCP server, include:

- Structured logs
- Request IDs
- Provider latency
- Cache hit/miss
- Error counts
- Optional metrics endpoint if running as a service
- Debug mode that explains where data came from

Example metadata:

```json
{
  "meta": {
    "source": "provider_name",
    "cache": "hit",
    "last_updated": "2026-01-12T02:14:33Z",
    "provider_latency_ms": 84
  }
}
```

---

## 14. Testing Strategy

A legitimate project needs tests from the start.

### 14.1 Unit tests

Test:

- Data normalization
- Search matching
- Error handling
- Cache behavior
- Date/time handling
- Stat calculations
- Provider capability fallback

### 14.2 Contract tests for providers

Every provider adapter should pass a shared test suite.

Example:

```text
Provider must:
- return normalized team objects
- return valid game statuses
- include last_updated metadata
- handle not found cleanly
- declare capabilities
```

### 14.3 Mock provider tests

CI should run fully without external API keys.

### 14.4 Golden response tests

For MCP tool outputs, store expected normalized JSON outputs.

This prevents accidental schema drift.

---

## 15. Documentation Plan

Docs should be a first-class part of the OSS project.

Recommended docs:

```text
README.md
docs/
  getting-started.md
  mcp-tools.md
  providers.md
  configuration.md
  deployment.md
  data-models.md
  contributing.md
  legal.md
  examples.md
```

README should include:

- What the project does
- Example questions users can ask
- Install/run instructions
- MCP client setup examples
- Supported tools
- Provider requirements
- Legal disclaimer
- Roadmap
- Contribution guide

---

## 16. Example User Flows

### 16.1 Fan asks live question

User:

> What NBA games are close right now?

Client calls:

1. `get_live_games`
2. Possibly `get_game_leaders` for close games

Response:

> The closest live game is Lakers-Nuggets, with the Lakers leading 82-78 midway through the third quarter. Nikola Jokić leads Denver with 28/12/9, while LeBron James has 24 points for Los Angeles.

### 16.2 Fantasy user asks about player

User:

> How has Jalen Johnson looked recently?

Client calls:

1. `search_players`
2. `get_player_recent_stats`
3. `get_player_game_log`
4. Optional `get_player_availability`

Response can include:

- Last 10 averages
- Minutes trend
- Scoring/rebounding trend
- Injury status if available

### 16.3 Writer asks for recap

User:

> Write a short recap of Celtics vs Bucks.

Client calls:

1. `resolve_game`
2. `get_game_box_score`
3. `get_game_play_by_play`
4. `summarize_game`

---

## 17. Minimum Viable Version

A realistic MVP should include:

### Core tools

- `get_server_capabilities`
- `search_teams`
- `search_players`
- `get_todays_games`
- `get_live_games`
- `get_game_status`
- `get_game_box_score`
- `get_game_play_by_play`
- `get_team_roster`
- `get_player_game_log`
- `get_player_recent_stats`
- `get_standings`

### Core features

- Provider adapter abstraction
- Mock provider
- One real provider adapter
- Cache
- Normalized models
- Structured errors
- Freshness metadata
- Basic docs
- Tests

Do not start with odds, advanced fantasy projections, or heavy analytics. Get core live data correct first.

---

## 18. Roadmap

### Phase 0: Design and scaffolding

- Define schemas
- Define provider interface
- Define MCP tools
- Create mock provider
- Create sample responses
- Write initial docs

### Phase 1: Core live stats

- Live scoreboard
- Today’s schedule
- Game status
- Box score
- Team/player search
- Caching
- Basic tests

### Phase 2: Play-by-play and summaries

- Play-by-play
- Recent game events
- Game leaders
- `what_just_happened`
- Basic recap generation from structured facts

### Phase 3: Historical/player/team stats

- Player game logs
- Recent player stats
- Team recent games
- Standings
- Team rosters
- Player comparisons

### Phase 4: Advanced analysis

- Trends
- Lineup data, if available
- Shot charts, if available
- Advanced stats
- Fantasy-focused tools
- Injury data

### Phase 5: Hosted/public-ready mode

- Auth/rate limiting
- Metrics
- Docker/deployment docs
- Hosted examples
- Public MCP registry/package listing, if applicable

---

## 19. What Makes This a Good MCP Server?

A good MCP server is not just “data available.” It should be:

### Useful

It answers questions people actually ask:

- Who is winning?
- Who is playing well?
- What just happened?
- How has this player performed lately?
- Who plays tonight?
- Is this player available?
- Compare these two players.

### Reliable

It should:

- Include timestamps
- Handle stale data
- Avoid hallucinated fields
- Return clear errors
- Normalize inconsistent provider data

### Discoverable

The server should make it easy for clients to know:

- What tools exist
- What arguments are valid
- What data is available
- Which provider capabilities are enabled

### Composable

Tools should be small enough that AI clients can combine them.

Example:

- Search player
- Fetch recent stats
- Fetch availability
- Compare with another player

### Opinionated but not restrictive

The server should provide useful high-level tools, but still expose enough structured data for advanced users.

---

## 20. Design Pressure Test

### Problem: “Live NBA stats” may be legally complicated

This is the biggest risk.

Mitigation:

- Provider abstraction
- User-provided API keys
- No bundled proprietary data
- Clear legal docs
- Mock provider
- Disable questionable sources by default

### Problem: The server could become too broad

NBA data can include:

- Scores
- Advanced stats
- Tracking data
- Odds
- Injuries
- Fantasy projections
- Historical databases
- Video metadata

Trying to do everything at once will fail.

Mitigation:

- Define core scope
- Use capability flags
- Add optional modules
- Keep MVP focused

### Problem: LLMs may misuse ambiguous names

Example:

- Jalen Williams vs Jaylin Williams
- Bogdanović vs Bojan/Bogdan
- Clippers vs LA

Mitigation:

- Strong search tools
- Ambiguity errors
- Canonical IDs
- Return candidates instead of guessing

### Problem: Provider schemas can vary wildly

Mitigation:

- Canonical internal models
- Provider contract tests
- Capability declarations
- Null-safe fields
- Data quality metadata

### Problem: Latency during live games

Mitigation:

- Cache
- Request coalescing
- Background refresh optional
- TTLs based on game status
- Avoid over-fetching play-by-play unless requested

### Problem: The server may return too much data for LLM context windows

Mitigation:

- Add `limit`
- Add summaries
- Add filters
- Support `include` fields
- Provide compact response modes

Example:

```json
{
  "game_id": "...",
  "include": ["score", "leaders", "recent_events"]
}
```

### Problem: Tool names could be too granular or too generic

Mitigation:

- Use intent-based tools
- Avoid raw provider tools
- Keep names predictable
- Document examples

### Problem: Users may expect betting advice

Mitigation:

- Do not include odds in core
- Make odds an optional adapter
- Include legal warnings
- Avoid encouraging gambling behavior by default

---

## 21. Clarification Questions

### Scope

1. Do you want this to be strictly NBA, or eventually WNBA/NCAA/G League too?
2. Is the initial focus live in-game stats, historical analysis, fantasy basketball, or all three?
3. Do you want this to include betting/odds at all, or should that be explicitly out of scope for v1?

### Data

4. Do you already have a data provider in mind?
5. Are you willing to support paid-provider adapters where users bring their own API keys?
6. Should the project include only official/licensed providers, or allow community adapters with warnings?
7. How fresh does “live” need to be: 5 seconds, 15 seconds, 60 seconds?

### Users

8. Who is the primary target user?
   - Fans?
   - Developers?
   - Fantasy players?
   - Sports writers?
   - Analysts?
9. Do you want this mainly for local MCP clients, or do you want to support hosted/public server deployments too?
10. Should the project support multiple users/API keys, or is local single-user enough at first?

### Features

11. Are injuries/player availability part of v1?
12. Are play-by-play events required for v1?
13. Do you want advanced stats like usage rate, true shooting, pace, offensive rating, defensive rating?
14. Should the server generate summaries itself, or only expose structured data so the connected AI model writes summaries?
15. Should fantasy-specific tools be in core or a separate optional module?

### OSS/Product

16. Do you want the repo to be positioned as a framework, a ready-to-run server, or both?
17. Would you prefer a plugin-style provider system so contributors can add data sources independently?
18. Do you want Docker/deployment support from day one?
19. Should there be a hosted demo server, or only local usage?
20. What license are you considering: MIT, Apache-2.0, AGPL, something else?

---

## 22. Recommended Initial Direction

For a serious OSS project, choose:

1. **NBA-only for v1**
2. **No betting/odds in core**
3. **Provider-agnostic architecture**
4. **Mock provider included**
5. **One real provider adapter if legally acceptable**
6. **Live games, box scores, schedules, standings, player search, team search for MVP**
7. **Play-by-play in v1.1**
8. **Fantasy tools in v1.2**
9. **Clear legal/provider docs**
10. **Strong schemas and tests from the beginning**

The most important thing: make it trustworthy. Sports fans will forgive missing features before they forgive wrong scores.
