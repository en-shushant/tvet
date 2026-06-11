# TVETtrack — Desktop Launcher

A native macOS app that starts the TVETtrack backend and opens it in a WebKit window.

## First launch

1. Right-click **TVETtrack.app** → **Open** → click **Open** in the dialog.  
   macOS remembers this; subsequent launches need no confirmation.
2. First cold start takes 3–8 s while Node.js boots and connects to the database.
3. If a "can't start" alert appears, check:  
   `~/Library/Logs/app-it/tvettrack/server.log`

## Daily use

| Action | Result |
|---|---|
| Click Dock icon | Opens window; starts server if not running |
| Red-X (close window) | Leaves server warm — next click reopens instantly |
| Cmd+Q | Closes window **and** stops the server |
| Cmd+R | Reload page |
| Cmd+Shift+R | Force reload |
| Cmd+± / Cmd+0 | Zoom in/out/reset |

## Rebuild after code changes

```bash
# Sync TVETtrack.html → backend/public/index.html first, then:
make desktop-build && make desktop-install
```

## Stop server without opening window

```bash
make desktop-quit
```

## Change the icon

Replace `assets/tvettrack-icon.svg`, then:

```bash
make desktop-icons && make desktop-build && make desktop-install
```

## Known limitations

- **Unsigned bundle** — Gatekeeper warns on first launch (right-click → Open to bypass).
- **Baked PROJECT_ROOT** — if you move the repo folder, re-run `make desktop-build && make desktop-install`.
- **Database** — the backend connects to Railway PostgreSQL; an internet connection is required.
- **WebKit, not Chromium** — use Safari devtools (Develop menu) for in-window debugging.
