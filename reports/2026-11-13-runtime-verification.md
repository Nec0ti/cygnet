# Cygnet runtime, test, and launcher verification

## Scope

This pass adds persistent server and platform usage totals, the seven-day progress display, a foreground launcher, module and HTTP integration checks, and a repeatable synthetic benchmark.

## Module checks

- **SQLite usage accounting** (`server/src/usage.js`): schema setup is idempotent; server runtime uses a monotonic clock; normal stop and crash recovery preserve checkpoints without counting downtime; overlapping tabs count as one foreground platform clock; stale browser sessions stop accruing after the 30-second bound.
- **HTTP server and reports** (`server/src/server.js`, `server/src/report.js`): isolated integration checks cover profile edits, follows, posts and stories, image upload/serve, likes, comments and replies, direct messages, message deletion, blocks, reports, persona system files, settings validation, experiment lifecycle, replay, exports, usage session validation, origin rejection, and graceful restart persistence.
- **Browser usage lifecycle** (`web/src/platform-usage.mjs`, `web/src/ResearchPanel.tsx`): focused/visible transitions, repeated React StrictMode setup, heartbeat, page-hide beacon, and recovery after server restart are self-checked. The page shows server uptime, platform usage, and progress to 604,800,000 ms.
- **Launcher** (`cygnet.sh`): an isolated launcher check confirms the API and Vite become reachable, then both stop on termination.
- **Other existing modules**: server storage, simulator, retry recovery, report, experiments, replay, Codex runner, seed data, and TypeScript production build all passed their checks.

## Results

- `./cygnet.sh check`: passed. This runs every check above and the web production build.
- `npm run benchmark`: passed for 100 and 1,000 profiles with 10,000 and 100,000 synthetic events, respectively; 10/10 functional benchmark assertions passed and measured endpoints returned zero HTTP errors.
- Detailed timing, response size, RSS, data size, and environment are in [`benchmark-2026-11-13T18-33.md`](benchmark-2026-11-13T18-33.md) and its JSON companion.
- All integration and benchmark databases used temporary directories. The existing `server/data/` directory was not used or changed by these checks.

## Limits

- At 1,000 profiles and 100,000 events, JSON report p95 was 5.02 seconds for one request and 38.99 seconds at concurrency 10. The response averaged 15.27 MB; report generation is the measured bottleneck at this synthetic upper workload.
- A visual browser E2E review and a real seven-day simulation were not run. The seven-day platform-time counter is persistent, and the user can stop the experiment when it reaches seven accumulated days.
- A hard server crash can lose up to one 15-second server checkpoint. An abruptly closed browser tab can overcount at most 30 seconds.
