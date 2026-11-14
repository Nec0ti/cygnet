# Architecture

Cygnet is a local web app with a React client, a Node.js API, SQLite persistence, and Codex CLI processes for persona decisions and image generation.

The Electron desktop shell starts the local API as a utility process, serves the compiled React app from that API, and opens it in a sandboxed browser window. The API remains bound to loopback. Packaged builds place writable state in the OS user data directory; the Windows portable executable stores it beside the executable.

## Runtime flow

1. `cygnet.sh` starts the API and Vite development server on loopback.
2. The API opens or initializes the SQLite store and writes each persona's `system.md` under the configured data directory.
3. The simulator finds due persona actions and asks the orchestrator to assign one action to each selected persona.
4. Persona agents write the content for assigned actions. Image requests go through Codex CLI image generation at publish time.
5. The API validates and persists actions, emits events and notifications, and updates persona relationship context.
6. The browser reads the API state and sends user actions back to the API.

The orchestrator is not counted against the configurable limit of 1–10 concurrent persona agents. Work is scheduled by the simulator; the application does not start one permanent model process for every profile.

## Code map

- `web/src/App.tsx` contains the main React application and API-backed interaction flows.
- `web/src/ResearchPanel.tsx` renders reports, cohort experiments, and event replay.
- `server/src/server.js` owns HTTP routes, bootstrap views, and action dispatch.
- `server/src/store.js` creates the SQLite schema and migrations.
- `server/src/simulator.js` selects due personas, requests orchestration plans, and dispatches validated actions.
- `server/src/seed.js` creates the initial profiles and resets the social dataset without adding posts or stories.
- `server/src/friend-hook.js` keeps friend relationships and persona prompt context in sync.
- `server/src/media.js` validates, stores, and serves local media.
- `engine/codex-runner.mjs` invokes Codex CLI and captures its result.
- `seed/generate.mjs` creates the initial persona profiles and `system.md` content.

## Persistent data

`CYGNET_DATA_DIR` relocates the database, generated/uploaded media, and persona prompt files together. Without it, data lives under `server/data/`. This separation lets checks and benchmarks use temporary directories without touching a real experiment.

The event log supports date-filtered reports and read-only replay. Replay reads past events; it does not dispatch the original actions again. See [Data handling and safety](data-and-safety.md) before using the export or reset controls.

## Verification

Run `./cygnet.sh check` for isolated server checks, API integration checks, browser tracking checks, a production web build, and launcher lifecycle checks. Run `./cygnet.sh benchmark` for synthetic workloads at 100 and 1,000 profiles. The benchmark does not call Codex or image generation.

Verification reports describe the environment and workload used. They are recorded evidence, not a claim that every machine or Codex account will have the same latency.
