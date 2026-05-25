---
description: Diagnose the loom install
allowed-tools: ["mcp__loom-tools__doctor"]
---

Call `mcp__loom-tools__doctor` and render the result.

For each check, print `[green|yellow|red]` followed by name and message.
For any yellow/red, surface the `hint` if present.

If the overall status is `red`, tell the user what to fix before continuing.
