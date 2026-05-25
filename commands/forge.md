---
description: Run the closed-loop forge on a route. Usage: /loom:forge --route <path> --goal "<goal>" [--max-iters N]
argument-hint: --route <path> --goal "<subjective goal>" [--max-iters 6] [--max-cost-usd 0.50]
allowed-tools: ["mcp__loom-tools__forge_run", "mcp__loom-tools__forge_iteration_record", "mcp__loom-tools__forge_squash", "mcp__loom-tools__forge_abort", "Task", "Edit", "Write", "Read", "Bash"]
---

Parse `$ARGUMENTS` for `--route`, `--goal`, `--max-iters`, `--max-cost-usd`.

Subcommands: `squash <runId>`, `abort <runId>`, `step <runId>` (manual single iteration).

Default path:

1. Call `mcp__loom-tools__forge_run` with `{ route_path, goal, max_iters, max_cost_usd }`.
   - If the response code is `E_FORGE_PRECONDITION`, surface the hint and stop.
   - Otherwise capture `runId`, `worktreePath`, `branch`, `loopInstructions`.

2. Follow `loopInstructions` literally. Each iteration:
   a. Dispatch `Task(subagent_type="visual-critic-with-goal", prompt=<goal + worktree route>)`.
   b. Apply ONE edit via Edit/Write tools INSIDE `worktreePath`.
   c. Re-render (Playwright or document a manual screenshot if Playwright is absent).
   d. Dispatch `Task(subagent_type="forge-judge", prompt=<score 0..100>)`.
   e. Call `forge_iteration_record` with `{ runId, iter, confidence, cost_delta }`.
   f. Apply convergence rules (≥90 break; <60 revert+retry once).

3. On loop exit:
   - confidence ≥ 75 → ask user to approve squash via `/loom:forge squash <runId>` (calls `forge_squash`).
   - otherwise → recommend `/loom:forge abort <runId>` (calls `forge_abort`) or keeping worktree for manual review.

4. Surface the transcript: per-iteration confidence + edit summary + final outcome.
