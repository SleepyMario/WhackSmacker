# WSM Tauri 2 proof
Isolated Linux/Android application, 0.1.0-alpha.5. Not a published release.
Uses a snapshot of the existing WSM review scheduler, plus a restricted Rust persistence bridge. One disposable Geography activity. No access to live WSM data, no curriculum import or migration. Application identity com.sleepymario.wsm.proof. Native app data stores proof-progress.json. Linux packaging builder VM101; Android VM301. Do not run builders simultaneously.
Build: npm ci; npm run tauri -- build --debug --no-bundle. Android: npm run tauri -- android init; npm run tauri -- android build --debug.
Acceptance: answer Brussels, verify saved count, close/relaunch and verify restored count on each native platform. Browser-only previews do not satisfy native acceptance.

## Source boundary
The core snapshot includes the current working-tree scheduler from kh, based on commit a91aa63e7a0ed1d1ffc22a8b6c59915b9bcc92dd plus existing local changes. It is deliberately copied rather than resetting or committing the user's dirty checkout. `core-snapshot-sha256.json` identifies the exact copied files. Only the scheduler and its browser-safe dependencies enter the frontend bundle. This proof has no CLI, sync, package-manager, or existing profile access.

The owner requested installation on kh for informal hands-on alpha testing. Native startup and build evidence will be reported separately from user acceptance and Android device testing.

## Alpha5 packaging
Ubuntu: wsm-cli and wsm-gui, version0.1.0~alpha.5-1. Gentoo GUI source build: wsm-gui-0.1.0_alpha5, with prebuilt web assets and vendored Rust sources for offline compilation. Windows: unsigned portable GUI proof, requires WebView2. Android: debug APK for ARM64 and x86_64. Docker: one CLI/browser image; the desktop Tauri GUI is not run inside Docker.

Linux proof was accepted by the owner. Android emulator accepted an answer and restored its saved review after force-stop/relaunch. Known limitations: one repeated Geography question; Android status-bar inset needs later polish; no real curriculum imports or cross-device sync. These intentionally remain separate from the established CLI profile.

Ubuntu wsm-cli requires Kitty at runtime by explicit owner decision (2026-11-22); retain the dependency until the owner changes that decision.
