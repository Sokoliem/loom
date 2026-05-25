---
description: Manage stakeholder review threads. Usage: /loom:review <list|get|create|resolve> [args]
argument-hint: list [--route /path] [--status open|resolved|rejected] | get <id> | create <route> <elt> <body> | resolve <id>
allowed-tools: ["mcp__loom-tools__review_threads_list", "mcp__loom-tools__review_thread_get", "mcp__loom-tools__review_thread_create", "mcp__loom-tools__review_thread_resolve"]
---

Parse `$ARGUMENTS` and dispatch.

`list` → call `review_threads_list` and render threads grouped by route.

`create` → call `review_thread_create` with the parsed args.

`resolve <id>` → call `review_thread_resolve` (defaults to `resolved`); use `--reject` to set `rejected`.
