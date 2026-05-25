---
description: Start the loom daemon (HTTP + WS) and open the studio in the browser
allowed-tools: ["mcp__loom-tools__daemon_start", "mcp__loom-tools__server_status", "mcp__loom-tools__stage_url"]
---

Start the loom daemon if not already running, then surface the studio URL.

1. Call `mcp__loom-tools__daemon_start`. This spawns the daemon detached and returns `{ running, pid, port, url }` once the run files appear (or throws if it didn't start within 6s).
2. If a project is currently open, also call `mcp__loom-tools__stage_url` to surface the stage URL for the active project.
3. Print both URLs and tell the user to open the daemon URL (or stage URL) in their browser. Do not auto-open — environments differ.

Output shape:
- daemon URL: `http://127.0.0.1:<port>` (root redirects to the current project's stage if one is open)
- stage URL (if project open): `http://127.0.0.1:<port>/loom/preview/<projectId>/`

If `daemon_start` reports the daemon was already running, treat that as success — just surface the existing URLs.
