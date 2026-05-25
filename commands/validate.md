---
description: Run validations. Usage: /loom:validate [axe|token-lint|ds-lint|deterministic-lint|all]
argument-hint: [axe|token-lint|ds-lint|deterministic-lint|all]
allowed-tools: ["mcp__loom-tools__validate"]
---

Parse `$ARGUMENTS`. Default to `["token-lint", "ds-lint", "deterministic-lint"]` if no args.

`all` → run all four kinds (including axe).

Call `mcp__loom-tools__validate` with `{ scope: "project", kinds }`.

Render findings as a table. For each finding, surface file:line, severity, rule, message, hint.

If axe is requested and the response indicates Playwright isn't installed, surface the install hint
and continue with the other kinds.
