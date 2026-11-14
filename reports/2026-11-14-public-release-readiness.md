# Public release readiness — Cygnet v0.1.0

## Changes

- Fixed the follow button on follow notifications so it updates between `Follow` and `Following` and toggles back after unfollowing.
- Replaced the demo human profile's real name/username with fictional values.
- Reworked the README and added architecture, data/safety, contribution, and `v0.1.0 — First Flight` release documentation.
- Added a sandboxed Electron desktop shell and a tag-triggered release workflow for Windows 10/11 x64 setup/portable builds and Linux x64 `.deb`/AppImage builds.
- Added a Cygnet icon, local API hosting for the packaged React app, a per-user data path, and Windows Codex CLI process launching.

## Verification

- `./cygnet.sh check`: passed, including isolated API integration and packaged static UI checks.
- Chromium 156 browser E2E: 22/22 checks passed, including follow → following → follow in Notifications.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Linux x64 AppImage and `.deb` builder runs completed. The `.deb` control metadata and bundled runtime paths were inspected; experiment data is not included.
- GitHub release workflow is configured to run verification, build on native Windows/Linux runners, smoke-test the packaged Linux window under Xvfb, calculate SHA-256 checksums, and create a release for a version tag.

## Limits

- Windows artifacts and the GitHub tag workflow still require a successful GitHub Actions run.
- The packaged Electron window was not launched in the local NixOS shell because the downloaded Electron binary needs host libraries such as `libglib-2.0`; the release workflow performs that smoke test on Ubuntu.
- The release is unsigned and x64 only. AppImage requires working FUSE support on Linux.
- The repository has no open-source license; it is explicitly marked `UNLICENSED` until the maintainer chooses one.
- `server/data/` remains on the local machine and is ignored by Git. The GitHub repository is still private; visibility has not been changed.
