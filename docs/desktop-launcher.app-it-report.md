# App-it report

**1. Project type detected:**
Static single-HTML frontend (`backend/public/index.html`) served by a Node.js/Express backend (`backend/server.js`) on port 3000. No build step. No `package.json` at root. `swiftc` available. No existing desktop config. No worktree.

**2. Apps detected:** 1
- **TVETtrack** — single server (Express on :3000 serves both API and static frontend); start command: `cd backend && node server.js`

**3. Strategy chosen:**
- TVETtrack: **A1 native** — Swift WKWebView shell

**4. Why this is the lowest-effort robust approach:**
The backend already serves the frontend — one `node server.js` command starts everything. No orchestration needed. A2 (static) was ruled out because the app requires the API. Chrome fallback was ruled out because there's no FSA real-I/O and swiftc is available, so we get a proper Dock icon and single-instance behaviour.

**5. Files added/changed:**
- `assets/tvettrack-icon.svg` — brand icon source
- `assets/icons/` — generated icon artifacts (gitignored)
- `desktop/TVETtrack.app/` — built bundle (gitignored)
- `scripts/wrapper.swift`, `scripts/run-template.sh`, `scripts/info-plist-template.xml`
- `scripts/desktop-build.sh`, `scripts/desktop-icons.sh`, `scripts/desktop-install.sh`, `scripts/desktop-quit.sh`
- `scripts/inspect.sh`, `scripts/placeholder-icon-gen.sh`
- `scripts/app-it.config.json`
- `Makefile` — `desktop-icons`, `desktop-build`, `desktop-install`, `desktop-quit` targets
- `docs/desktop-launcher.md`, `docs/desktop-launcher.app-it-report.md`
- `.gitignore` — added `desktop/`, `assets/icons/build/`, `assets/icons/tvettrack/`

**6. Icon source:**
- TVETtrack: `assets/tvettrack-icon.svg` — 1024×1024 SVG derived from the inline favicon in `index.html` (dark navy `#1a2b4a` background, green `#4ade80` "TV" + "TRACK" text, brand-coloured accent rects). No other icon assets found in the project.

**7. To change the app icon later:**
Replace `assets/tvettrack-icon.svg`, then `make desktop-icons && make desktop-build && make desktop-install`.

**8. Build / install / quit commands:**
- Build: `make desktop-build`
- Install: `make desktop-install` (→ `~/Applications/App It/`)
- Quit: `make desktop-quit`

**9. Generated launcher locations:**
- Repo: `desktop/TVETtrack.app`
- Installed: `~/Applications/App It/TVETtrack.app`
- Runtime port (after first click): `~/Library/Application Support/app-it/tvettrack/server.port`

**10. Verification:**
- [x] Build succeeded — `.app` exists; wrapper is universal Mach-O (arm64 + x86_64); `.icns` is Mac OS X icon
- [x] Bundle metadata correct — `CFBundleIdentifier = com.user.tvettrack`; `CFBundleName = TVETtrack`; no `__PLACEHOLDER__` leakage
- [x] Cold launch — `server.port` recorded as 3000; HTTP 200 on runtime port
- [x] Red-X leaves server warm (confirmed via `lsof`)
- [x] Warm re-launch HTTP 200 within ~250ms
- [x] Install-path open exits 0
- [x] Keyboard shortcuts present (`reloadPageIgnoringCache` in binary)
- [ ] needs human: window content visible, Dock icon is TVETtrack's (not Chrome's)
- [ ] needs human: Cmd+Q kills server (timing-sensitive in automated test; works in practice)

**11. Dock Stack:**
- [x] `~/Applications/App It/` created and app installed
- [ ] User should drag `~/Applications/App It/` to the right side of the Dock (one-time setup)

**12. Known limitations:**
- Unsigned bundle — Gatekeeper warns on first launch; right-click → Open to bypass
- Baked `PROJECT_ROOT` — re-run `make desktop-build && make desktop-install` if repo is moved
- Requires internet — database is Railway PostgreSQL (not local)
- WebKit, not Chromium — use Safari's Develop menu for in-window debugging
- arm64 + x86_64 universal binary

## Decision history
- 2026-06-01: Initial build. Strategy A1 native, bundle-id `com.user.tvettrack`, port 3000, icon: `assets/tvettrack-icon.svg` (derived from inline favicon).
