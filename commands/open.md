---
description: Open a loom project by name. Usage: /loom:open <name>
argument-hint: <project-name>
allowed-tools: ["mcp__loom-tools__project_open", "mcp__loom-tools__project_list", "mcp__loom-tools__stage_url"]
---

Open the project named `$ARGUMENTS`.

1. If `$ARGUMENTS` is empty, call `project_list` and ask the user which to open.
2. Call `project_open` with the name.
3. Surface stage URL via `stage_url`.
