---
description: Create a version snapshot. Usage: /loom:snapshot [label]
argument-hint: [label] [-m message]
allowed-tools: ["mcp__loom-tools__version_snapshot", "mcp__loom-tools__version_list"]
---

Parse `$ARGUMENTS` for label + optional `-m <message>`.

1. Call `version_snapshot` with `{ label, message }`.
2. Surface `{ id, branch, label, parentId }`.
3. Suggest `/loom:branch list` to see branch heads.
