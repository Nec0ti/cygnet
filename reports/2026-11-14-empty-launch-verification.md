# Empty launch and live persona content verification

- Date: 2026-11-14 (local session; benchmark timestamp is recorded in its own report)
- Scope: empty first launch/reset, persona-driven live post/story path, empty-feed engagement choices, browser flows, and isolated performance baseline.
- Data safety: all checks used temporary directories. `server/data/` and any real experiment records were not reset or edited. The seven-day experiment was not started.

## Changes

- Removed the fixed caption list and the 28 post / 12 story insert loops from `server/src/seed.js`. Fresh databases and `resetSeedStore()` now create profiles, profile portraits, and persona friend edges with an empty content table.
- Kept per-persona post/story due times. When one becomes due, the orchestrator assigns the action, the persona runner writes the caption and image brief, imagegen generates the image, and the server stores the new post/story.
- With no candidate posts, the orchestrator no longer receives like/comment as allowed actions. It can still wait, publish, follow, or choose another valid due action.
- Added seed/reset/API assertions and deterministic simulator checks for live persona post/story generation. Updated the Chromium E2E to verify the initially empty feed, explicit persona publication, follow-gated story visibility, and an empty feed after reset.

## Verification

- `./cygnet.sh check`: passed all server/seed/simulator/visibility/report/experiment/usage/integration/runner checks, TypeScript and Vite production build, and launcher lifecycle.
- Chromium 156 E2E: 20/20 check groups passed. It confirmed 0 initial posts and stories, then publication, likes/comments, story privacy, profile/DM/admin/research flows, and 0 posts/stories after the two-step reset.
- `./cygnet.sh benchmark`: 100 profiles / 10,000 events and 1,000 profiles / 100,000 events each scored 5/5 correctness with zero HTTP errors. Full latency table: `benchmark-2026-11-13T21-19.md` and JSON data beside it.
- At 1,000 profiles, bootstrap p95 was 398.29 ms at concurrency 1 and 3,120.01 ms at concurrency 10. Report p95 was 3,968.08 ms and 37,112.38 ms, respectively; the synchronous report path remains the measured slow endpoint.
- Focused checks: `server/src/self-check.js`, `server/src/simulator-retry-self-check.js`, and `server/src/simulator-image-self-check.js` passed. The image check uses a deterministic fake Codex runner/imagegen output to exercise live post/story and DM dispatch without external generation calls.

## Limits

- No real Codex CLI imagegen request was made in this verification; only its existing deterministic simulator test seam was exercised. The persona-to-imagegen code path was not changed.
- No long-running or seven-day experiment was run. Real-world timing and image generation still depend on Codex CLI availability, quotas, and the selected persona's scheduled action.
