# Human DM reply routing

- Date: 2026-11-14
- Scope: keep a human DM reply opportunity separate from routine persona DM initiation.
- Data safety: diagnosis used read-only queries on the active local DB. No conversations or messages were reset or deleted.

## Diagnosis

- Several recent human DMs were marked read, while the corresponding persona's later `message.sent` event belonged to a conversation with another AI account.
- The shared `dm_due_at` and `last_dm_at` fields treated any outgoing persona DM as if it had answered the human. This could push the next human response opportunity hours into the future.
- A plain greeting was not the cause; the action planner was allowed to redirect the persona's DM to another account.

## Changes

- Added `human_reply_due_at` as an independent schedule for incoming human messages.
- When a persona chooses `dm` while a human reply is pending, the planner's target is constrained to the human account. It may still choose `wait`, preserving the seen-without-reply behavior.
- A successful human reply clears only the pending reply opportunity it handled. Choosing wait closes that opportunity; another incoming human message schedules a new one.
- Existing databases migrate without clearing messages and backfill unanswered human messages into the reply queue.

## Verification

- `./cygnet.sh check` passed, including API schedule/clear, simulator target correction, typing/read receipt checks, and an old-schema migration fixture.
- Chromium 156 browser E2E passed 21/21 checks.
- Active `server/data/` was not reset. The running process needs a normal restart to load the new code and perform the one-time migration.
