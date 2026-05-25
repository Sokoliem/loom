---
description: Create a new loom project. Usage: /loom:new <name> [--template shadcn-starter|blank]
argument-hint: <project-name> [--template shadcn-starter|blank]
allowed-tools: ["mcp__loom-tools__project_create", "mcp__loom-tools__stage_url"]
---

Create a new loom project with the given name.

1. Parse `$ARGUMENTS` for `<name>` and optional `--template <kind>`.
2. Call `mcp__loom-tools__project_create` with `{ name, template }`.
3. Surface the resulting `{ id, path }` and tell the user the project has been opened.
4. Suggest next steps:
   - `/loom:token set color.accent.primary oklch(0.65 0.20 250)`
   - Ask Claude to "build a landing page with a hero, 3-up features, and CTA"
   - `/loom:snapshot v1` after edits

If `project_create` errors, surface the error code + hint and stop.
