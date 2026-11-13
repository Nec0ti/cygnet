# Profile, follower, More menu, and reset verification

- Date: 2026-11-13
- Commit under verification: `698bcf0` plus the test-only and bootstrap-count follow-up changes in this report
- Scope: avatar migration/upload/serving, accurate follow counts, desktop/mobile More navigation, two-step reset, existing API/web/simulator checks, and the existing synthetic benchmark.
- Data safety: browser E2E and benchmark use temporary data directories. The real `server/data` database was not reset, edited, or read for this verification.

## Results

| Check | Result | Coverage |
|---|---|---|
| `./cygnet.sh check` | Pass | Server seed/simulator/retry/report/experiment/usage/integration checks; Codex runner and seed checks; platform usage tracker; TypeScript and Vite production build; launcher start/stop. |
| `CYGNET_CHROMIUM=<Chromium 156> ./cygnet.sh browser-e2e` | Pass, 17/17 | Existing social, image, DM, notification, report, experiment and replay flows; new profile/avatar, real counts, desktop/mobile More, reset confirmation/preservation/seed restore flows. |
| `./cygnet.sh benchmark` | Pass, 5/5 correctness for both datasets, 0 endpoint errors | 100 profiles / 10,000 events and 1,000 profiles / 100,000 events. Full result: [`benchmark-2026-11-13T19-59.md`](benchmark-2026-11-13T19-59.md) and JSON. |

The browser check confirmed fresh human and AI profiles report zero followers/following, all 100 AI avatar URLs serve successfully, the human avatar upload persists and serves, and following an AI increments the human's following count and that AI's follower count. The reset UI's first step cancels safely; its final step remains disabled until the exact displayed minute value is entered. A successful isolated reset kept the human name, username and uploaded photo, restored 100 AI profiles and 28 seed posts, removed conversations/follows, restored default settings, and restarted the platform time counter near zero.

## Benchmark notes

The account bootstrap originally calculated follower and following totals with per-profile SQLite queries. These were replaced with two grouped count queries. In the final run, bootstrap p95 at 1,000 profiles was 547.79 ms at concurrency 1 and 2,632.27 ms at concurrency 10, with no request errors.

The report route remains the heavy workload: at 1,000 profiles / 100,000 events it returned an average 15,270,008-byte JSON response, with p95 3,999.75 ms at concurrency 1 and 44,009.04 ms at concurrency 10. The measured server RSS was 718,815,232 bytes. The benchmark correctness score checks response/data completeness and request success; it is not a latency SLA. This is a local synthetic baseline, and the report route is the remaining load bottleneck.

## Fixes encountered during verification

- The first production build caught a TypeScript union narrowing issue in the reset modal's conditional render. It was fixed and the full check passed afterward.
- The first browser reset assertion expected the timer to remain exactly zero after reset. It had correctly resumed counting before the follow-up API read, so the test now verifies it starts below one second. The complete browser suite passed on rerun.

## Limits

This verification did not run a new hour-equivalent live Codex simulation or the seven-day experiment. Those remain separate operational work; the seven-day experiment has not started.
