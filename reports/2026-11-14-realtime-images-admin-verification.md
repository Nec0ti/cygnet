# Cygnet 2.2 verification report

## Scope

- Personalized, distinct raster portraits for the first 100 AI profiles; refresh existing local DBs that have the previous 20-portrait seed files on startup.
- Generate post/story images at publication time and DM images at message time using the built-in Codex CLI imagegen, including AI–AI messages.
- Apply story visibility according to follows, blocks, and expiry on both human and persona sides.
- Verify actual behavior of the local admin area in More, dark theme, and profile/DM/content buttons.

## Implementation

- Generated 100 portrait files and verified that all 100 file SHA-256 values differ. Seed checks verify new profiles receive different files and migration is applied to old `profile-01.jpg`-style seed avatars.
- Posts, stories, DMs, and an alternative account image opened through block circumvention use the existing Codex CLI `generatePostImage` pipeline. Content photos are not pre-seeded. Generated photos are checked against post and DM fingerprints and retried if duplicated.
- The DM persona prompt asks the other party to return an image prompt when they explicitly request a photo, and allows occasional natural photo sending in AI–AI conversations too. Realtime self-check verifies two AI DMs with human and AI recipients.
- The story API returns the user's own stories and stories from followed, unblocked, non-expired accounts. Persona task context uses the same function.
- The admin panel shows metrics and personas; saves persona notes/traits, refreshes `system.md`, pauses personas, changes report status, and deletes posts/stories.

## Verification

- `./cygnet.sh check`: passed. Includes server seed/action/usage/report/experiment checks, Codex runner and launcher lifecycle, and web TypeScript/production build.
- `scripts/browser-e2e.mjs`: 19/19 checks passed with Chromium 156.0.8078.47. The flow included initial AI story privacy, visibility after follow/unfollow, 100 different avatar URLs, default dark theme, profile photo upload, human–persona DM/photo/delete, notifications, More, admin persona/report/content actions, report, and reset.
- Generated one AI → human DM photo using real Codex CLI imagegen in an isolated temporary DB. The simulated persona response included `imagePrompt`; a PNG was added to the `message.send` payload, and PNG signature, 2,278,098-byte file, and SHA-256 were checked. Test media was deleted with the temporary directory.
- An additional isolated self-check used mock imagegen to check AI → AI DM photos and an alternative profile avatar after the first 100. HTTP integration checked that DM media is saved to the message, the alternative avatar to the new account, the media is served, and a second identical fingerprint is rejected.
- `./cygnet.sh benchmark`: for both 100 profiles/10,000 events and 1,000 profiles/100,000 events, both sets scored 5/5 correctness with 0 HTTP errors on all measured routes. Full results are in `reports/benchmark-2026-11-13T20-43.md` and `.json`.

## Performance note

In the 1,000-profile, 100,000-event benchmark, the report endpoint returned an average of 15.27 MB of JSON; p95 was 4.07 sec for one request and 43.39 sec at concurrency 10. Other measured routes succeeded. Concurrent calls to large experiment reports remain noticeably slow.

## Limits

This check was not a real one-week experiment; the seven-day duration timer and local experiment have not yet been started. One AI → human DM photo smoke test used real imagegen; AI–AI and alternative account image flows were checked in isolated automated tests with mock imagegen. Alternative account generation beyond 100 accounts was not separately called with real imagegen.

Browser, benchmark, and API tests used temporary/isolated data; `server/data` was not changed.
