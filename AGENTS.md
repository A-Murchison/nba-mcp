# AGENTS.md

Guidance for coding agents working in this repository:

- Keep changes focused and consistent with the existing codebase.
- Do not commit secrets, credentials, local paths, generated files, or other unnecessary artifacts.
- Act like a professional developer: understand the task, inspect the existing code and docs, and make the smallest clean change that solves the problem.
- Prefer clear, maintainable implementations over clever shortcuts. Follow existing project style and conventions.
- Keep changes focused. Avoid unrelated refactors, formatting churn, or speculative features.
- Validate your work with appropriate tests, builds, or manual checks when available. If validation cannot be run, state why.
- Keep `README.md` up to date with anything relevant for end users to successfully install, configure, run, or use the project.
- Keep `PLAN.md` up to date with meaningful changes to scope, architecture, implementation steps, priorities, or completed work.
- Ensure the `README.md` doesn't contain information about the `PLAN.md`. 
- Document important assumptions, tradeoffs, and user-facing behavior changes in the appropriate place.
- Handle errors thoughtfully and avoid hiding failures.
- Do not commit secrets, credentials, local machine paths, generated noise, or large unnecessary files.
- Before finishing, summarize what changed, how it was validated, and any remaining follow-up work.

## GitHub Actions security

- Pin every GitHub Action in workflow `uses:` steps to a full 40-character commit SHA, not a mutable tag or branch. Include the corresponding release tag in an inline comment (for example, `# v4`) for maintainability.
- Keep the `github-actions` Dependabot configuration enabled so pinned action revisions receive update pull requests.

## NBA.com request headers

NBA CDN endpoints require browser-compatible headers. Keep these headers in `src/providers/NbaComProvider.ts` and apply them to requests for `cdn.nba.com`, including:

- Live scoreboard: `/static/json/liveData/scoreboard/todaysScoreboard_00.json`
- Live box score and play-by-play endpoints under `/static/json/liveData/`
- Season schedule: `/static/json/staticData/scheduleLeagueV2_1.json`

Use the following header values (do not add cookies or other credentials):

```text
Accept: */*
Accept-Language: en-US,en;q=0.9
Origin: https://www.nba.com
Referer: https://www.nba.com/
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-site
Priority: u=4
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0
```

Node's fetch implementation manages `Host`, compression, and transfer-encoding headers; do not set them manually. `stats.nba.com` may use its endpoint-specific JSON/cache-control headers in addition to the browser headers. Do not use the blocked `core-api.nba.com` gamecard feed for schedule lookups; use the CDN season schedule instead.
