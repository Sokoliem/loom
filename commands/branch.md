---
description: Manage branches. Usage: /loom:branch <create|list|switch|merge> [args]
argument-hint: create <name> [--from base] | list | switch <name> | merge <from> into <into>
allowed-tools: ["mcp__loom-tools__branch_create", "mcp__loom-tools__branch_list", "mcp__loom-tools__branch_switch", "mcp__loom-tools__branch_merge"]
---

Parse `$ARGUMENTS` and dispatch to the matching tool.

For `merge`: confirm the from/into branches with the user before calling `branch_merge`.
If `branch_merge` returns `ok: false` with conflict text in stderr, surface the conflict files
and offer to walk them with the user file-by-file.
