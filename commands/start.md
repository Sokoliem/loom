---
description: Start the loom daemon (HTTP + WS) and open the studio in the browser
allowed-tools: ["mcp__loom-tools__server_status", "mcp__loom-tools__stage_url", "Bash"]
---

Start the loom daemon if not already running, then return the studio URL.

1. Call `mcp__loom-tools__server_status` to check if a project is open.
2. If no daemon process is detected (no entry in ~/.loom/server/pid), instruct the user:
   - `pnpm dlx loom start` (or `npx loom start`) — runs the daemon in the foreground.
3. Call `mcp__loom-tools__stage_url` and surface the URL.
4. Tell the user to open the URL in a browser (we do not auto-open; environments differ).

Surface the daemon URL in the chat. If a project is open, also surface its stage URL.
