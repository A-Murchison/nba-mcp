# Phase 1 Canonical Live Data Models

Phase 1 defines the normalized internal data shapes that providers return before MCP tools expose data to clients.

## Canonical models

The canonical TypeScript models live in `src/domain/models.ts` and cover:

- `Team`
- `Player`
- `Game`
- `GameStatus`
- `LiveGame`
- `BoxScore`
- `PlayerBoxScore`
- `TeamBoxScore`
- `PlayByPlayEvent`
- `Roster`
- `ResponseMetadata`

Providers must return these models instead of raw upstream provider payloads. This keeps MCP tool contracts independent from nba.com or any other data source.

## Freshness metadata

Every successful provider response includes `meta`:

```json
{
  "source": "mock",
  "lastUpdated": "2026-01-12T02:14:33.000Z",
  "dataFreshnessSeconds": 8,
  "isLive": true,
  "cacheStatus": "bypass",
  "providerLatencyMs": 0
}
```

The raw mock provider uses `cacheStatus: "bypass"`. The Phase 3 cache decorator wraps configured providers and changes exposed responses to `hit` or `miss` as appropriate; it also updates `dataFreshnessSeconds` at response time.

## Error format

Structured error responses are defined in `src/domain/errors.ts`. Tools and services should use those shared error codes rather than inventing tool-specific error shapes.

## Mock provider

`src/providers/mock/MockProvider.ts` now returns normalized sample data for all v0.1 provider methods. The sample data is intentionally small and hand-authored so the repository can run without API keys or proprietary NBA data dumps.
