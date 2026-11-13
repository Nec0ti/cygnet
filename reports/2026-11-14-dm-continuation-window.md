# DM continuation window

- Date: 2026-11-14
- Scope: fast replies while a human/AI DM exchange is active, then return to normal persona timing after silence.
- Data safety: no active experiment data was reset.

## Behavior

- Every AI DM to the human opens a 60-second real-time continuation window.
- A human message received inside that window is made immediately due and requests a simulator tick. If another tick is already running, one follow-up tick is queued.
- Active continuations are routed to the human and sent without another orchestrator wait decision. This keeps a live back-and-forth responsive.
- After 60 seconds without a human message, the window expires; later messages use the existing personality- and simulation-speed-based reply delay.

## Verification

- `./cygnet.sh check` passed, including API checks for the one-minute window and immediate follow-up due time, plus simulator checks that an active continuation replies immediately and an expired window permits waiting.
- Chromium 156 browser E2E passed 21/21 checks.
- This feature uses a database migration for existing accounts; restart the local app to load it. The current running process was left untouched.
