# DM reply timing and read receipts

- Date: 2026-11-14
- Scope: inbound DM response timing, live conversation refresh, message read persistence, AI receipt of human messages, and personality-based follow-up after a human reads an AI DM without replying.
- Data safety: tests used temporary databases. The user's `server/data/` was not reset or modified.

## Diagnosis

- Human messages only updated `last_contact_at`. Personas with `frequent` or `occasional` initiation waited for their existing 6 or 36 hour initiation time before considering a DM; only `only_after_contact` personas considered the incoming message due.
- The React DM screen fetched bootstrap once, so AI replies arriving after the page loaded were not shown until a later UI action/reload.
- Messages had no read timestamp, so neither side could observe a receipt or schedule a follow-up based on an unanswered seen message.
- Posts and stories still use their per-persona scheduled intervals (hours); an empty profile shortly after reset is expected.

## Changes

- Incoming AI DMs now schedule separate read and reply opportunities. The read action opens unread conversations and records seen without sending a reply. DM reply opportunities use a 2–35 minute trait-based delay (shyness, sociability, impulsivity), scaled by simulation speed; the orchestrator still decides whether the persona replies or waits.
- The DM view shows the persona's typing indicator while it generates a response; simulator self-check verifies the active state and its cleanup after the tick.
- The Messages page refreshes while open. Opening a conversation persists `read_at`; AI agents can also mark incoming messages read independently from replying.
- If a persona's message was read by the human and no reply followed, its later DM prompt tells the agent it may mention being left on read or wait, depending on personality. It must not guilt, threaten, or repeatedly pressure.
- Existing databases migrate `messages.read_at`, `accounts.read_due_at`, `accounts.seen_due_at`, and `accounts.typing_until` without clearing conversations.

## Verification

- `./cygnet.sh check` passed: seed, visibility, simulator due-action, simulator/image, retry, report, experiment, usage, API integration, runner, TypeScript/Vite build, and launcher checks. The integration check verifies inbound DMs schedule separate read and reply opportunities.
- Real Chromium 156 browser E2E passed 21/21 checks. It verified a new AI reply appears while the chat is open and the AI's read receipt appears beneath the human's sent message.
- API integration verifies incoming human DM schedules future read and DM actions, human and AI reads persist, reading a conversation as a non-member is rejected, and human reads schedule a persona seen-follow-up decision. Simulator self-check confirms a standalone AI read action creates no DM.
- No performance benchmark was run; the work changes DM scheduling and display, not large-query endpoints. No real Codex CLI generation or long-duration experiment was run.
