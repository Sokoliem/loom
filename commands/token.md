---
description: Get, set, or list design tokens. Usage: /loom:token <get|set|list|resolve> [args]
argument-hint: get <ref> | set <ref> <value> | list [namespace] | resolve
allowed-tools: ["mcp__loom-tools__token_get", "mcp__loom-tools__token_set", "mcp__loom-tools__token_list", "mcp__loom-tools__token_resolve_all"]
---

Parse `$ARGUMENTS` and dispatch:

- `get <ref>` → call `token_get` with `{ ref }`, surface the resolved value.
- `set <ref> <value>` → call `token_set` with `{ ref, value }`. Confirm success.
  - If response code is `E_TOKEN_CYCLE`, surface the cycle path so the user can break it.
- `list [namespace]` → call `token_list` with `{ namespace }`, render as a table.
- `resolve` → call `token_resolve_all`, render the full resolved map.

If the user passes an unknown subcommand, list valid ones.
