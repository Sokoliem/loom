---
description: Stop the loom daemon
allowed-tools: ["mcp__loom-tools__daemon_stop"]
---

Stop the running loom daemon (and any per-project Vite dev servers it owns).

1. Call `mcp__loom-tools__daemon_stop`. It sends SIGTERM to the daemon PID recorded in `~/.loom/server/pid`.
2. Report whether the daemon was running. If it wasn't, that's fine — just say so.
