# Public release readiness — Cygnet v0.1.0

## Changes

- Fixed the follow button on follow notifications so it updates between `Follow` and `Following` and toggles back after unfollowing.
- Replaced the demo human profile's real name/username with fictional values.
- Reworked the README and added architecture, data/safety, contribution, and `v0.1.0 — First Flight` release documentation.
- Added a sandboxed Electron desktop shell and a tag-triggered release workflow for Windows 10/11 x64 setup/portable builds and Linux x64 `.deb`/AppImage builds.
- Added a Cygnet icon, local API hosting for the packaged React app, a per-user data path, and Windows Codex CLI process launching.

## Verification

- `./cygnet.sh check`: passed, including isolated API integration and packaged static UI checks.
- Node.js 22 CI verification: passed on GitHub Actions.
- Chromium 156 browser E2E: 22/22 checks passed, including follow → following → follow in Notifications.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Linux x64 AppImage and `.deb` builder runs completed. The `.deb` control metadata and bundled runtime paths were inspected; experiment data is not included.
- GitHub Actions release run [43634628213](https://github.com/Nec0ti/cygnet/actions/runs/43634628213): all jobs passed, including the Linux packaged-window smoke test under Xvfb.
- Release [v0.1.0 — First Flight](https://github.com/Nec0ti/cygnet/releases/tag/v0.1.0) contains Windows setup and portable executables, Linux `.deb` and AppImage files, and `SHA256SUMS.txt`. The manifest was downloaded and matches the asset SHA-256 metadata.
- CI found and fixed Node 22 SQLite boolean-binding compatibility, Electron Builder's automatic publishing attempt, the packaged seed-generator omission, and the Electron utility-process startup check.

## Limits

- Windows setup and portable packages were built on `windows-latest`; they were not launched in a Windows session during this verification.
- CI launched and closed the unpacked Linux app under Xvfb; it did not separately install the `.deb` or launch the AppImage.
- The release is unsigned and x64 only. AppImage requires working FUSE support on Linux.
- The project is now MIT-licensed; see `LICENSE`.
- `server/data/` remains on the local machine and is ignored by Git. The GitHub repository is still private; visibility has not been changed.
