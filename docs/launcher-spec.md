# Windows launcher

`ROOT starten.cmd` selects PowerShell 7 when available, with Windows PowerShell 5.1 as fallback. `start.ps1` resolves the application directory from its own location and finds `node.exe` on PATH. Install Node.js 24 or 26 before starting; no machine-specific installation path is assumed.

The launcher targets loopback port 18473 and the local `data/` directory. A matching ROOT 1.4 health response reuses the listener; a conflicting or older listener produces a message. Otherwise it starts the server in a hidden process, redirects logs into `data/`, waits for a bounded health response and opens the local page. `-NoBrowser` suppresses browser opening.

For independent ports/data directories, use `node server.cjs` with `ROOT_PORT` and `ROOT_DATA_DIR` as described in [CONTRIBUTING.md](../CONTRIBUTING.md). The launcher deliberately owns its default instance parameters.

The implementation uses Start-Process argument, working-directory, hidden-window and redirection parameters supported by both PowerShell paths. It temporarily sets and then restores the child environment. Health requests detect available timeout parameters, avoiding PowerShell 7-only parameter assumptions on Windows PowerShell 5.1.
