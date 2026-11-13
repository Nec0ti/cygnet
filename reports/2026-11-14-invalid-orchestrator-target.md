# Invalid orchestrator target recovery

- Date: 2026-11-14
- Symptom: Admin showed `Plan references an invalid account`, with zero active and queued personas.
- Diagnosis: `validateActionPlan()` rejected a due DM/follow target that was missing from the candidate accounts or was the acting persona itself. The simulator validates the full batch before executing any action, so one bad reference rejected the tick. Selected personas entered retry backoff; with no remaining due entries the status showed 0 active and 0 queued. The exact target returned in the user's failed model response was not persisted, so whether it was a self-target or unknown ID cannot be distinguished afterward.
- Fix: The orchestrator prompt now explicitly forbids self-targets and unknown account IDs. Invalid/self/blocked DM or follow targets are converted to `wait`, preserving validation and preventing any social action against the bad target. On startup, retry metadata for this exact prior validation error is cleared so the fixed planner can retry immediately.
- Verification: `node server/src/simulator-retry-self-check.js` verifies an invalid self-follow becomes wait without executing an action and that stale retry state clears at startup. `./cygnet.sh check` passed all server checks, production build, and launcher lifecycle.
- Data: Verification used in-memory or temporary data. The running user's SQLite database was read only through `/api/simulator` and `/api/events`; no reset or manual data changes were made.
