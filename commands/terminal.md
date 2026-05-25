---
description: Start, stop, or check the in-browser claude PTY session for the current project
allowed-tools: ["mcp__loom-tools__terminal_start", "mcp__loom-tools__terminal_stop", "mcp__loom-tools__terminal_status", "mcp__loom-tools__server_status"]
---

Manage the per-project claude PTY session that the loom studio mirrors into its
terminal pane (composed from `@celestial/forge.createClaudeRuntime` +
`@celestial/lens.PtyScreenBuffer` + `@celestial/rift`).

Parse `$ARGUMENTS` for one of: `start` (default), `stop`, `status`.

1. If the argument is `stop`: call `mcp__loom-tools__terminal_stop`. Report whether a session was running.
2. If the argument is `status`: call `mcp__loom-tools__terminal_status`. Surface `{ running, pid, cols, rows }`.
3. Otherwise (default `start`): call `mcp__loom-tools__terminal_start`. Surface the daemon URL + tell the user to refresh the studio tab; the terminal pane will auto-attach when it sees the session.

The session is one-per-project, lives as long as the daemon, and OAuth is handled by `claude` itself inside the PTY (no `-p`, no API key).
