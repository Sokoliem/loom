---
description: Manage components. Usage: /loom:component <create|get|list|update|delete> [args]
argument-hint: create <Name> | get <Name> | list [filter] | update <Name> | delete <Name>
allowed-tools: ["mcp__loom-tools__component_create", "mcp__loom-tools__component_get", "mcp__loom-tools__component_list", "mcp__loom-tools__component_update", "mcp__loom-tools__component_delete"]
---

Parse `$ARGUMENTS` and dispatch to the matching MCP tool.

For `create`: prompt the user for description + tokens used if not supplied. Call `component_create`.

For `update`: read the current source via `component_get`, ask what to change, then call `component_update`.

For `delete`: confirm the name with the user (destructive) before calling `component_delete`.
