---
description: Manage routes. Usage: /loom:route <add|get|list|update|delete> [args]
argument-hint: add <path> | get <path> | list | update <path> | delete <path>
allowed-tools: ["mcp__loom-tools__route_create", "mcp__loom-tools__route_get", "mcp__loom-tools__route_list", "mcp__loom-tools__route_update", "mcp__loom-tools__route_delete"]
---

Parse `$ARGUMENTS` and dispatch.

For `add`: ask the user for a body if not supplied (suggest scaffolding from one of the existing components). Call `route_create` with `{ path, body, meta? }`.

For `update`: surface the current route, ask for the change, call `route_update`.

For `delete`: confirm before calling `route_delete`.
