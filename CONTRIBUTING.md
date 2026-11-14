# Contributing

Thanks for taking an interest in Cygnet. The project is an experimental, local-first simulation; keep changes small and make data boundaries clear.

## Before opening a change

1. Create fictional test data in a temporary directory. Never commit `server/data/`, conversation exports, credentials, or real people's private information.
2. Run the checks relevant to your change:

   ```sh
   ./cygnet.sh check
   CYGNET_CHROMIUM=/path/to/chromium ./cygnet.sh browser-e2e
   ```

3. For changes to database/API behavior, run the isolated benchmark when performance may be affected:

   ```sh
   ./cygnet.sh benchmark
   ```

4. Include a concise report of what you changed and what you verified. Do not attach private experiment exports.

## Project conventions

- Keep the unauthenticated API bound to loopback; this app is not designed for network exposure.
- Preserve the empty-feed launch and reset behavior. New posts and stories are created by simulation actions.
- Keep model prompts and image generation on the existing Codex CLI path; do not add API keys to the repository.
- Update `backlog.md` and add a verification report when a substantial behavior or release milestone changes.

Cygnet is distributed under the [MIT License](LICENSE). Contributions may be used and redistributed under those terms.
