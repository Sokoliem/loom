---
description: Run a 5-agent design panel on a scope. Usage: /loom:panel <scope> [focus]
argument-hint: <scope-path> [focus]
allowed-tools: ["mcp__loom-tools__panel_run", "mcp__loom-tools__panel_ingest_findings", "Task"]
---

Parse `$ARGUMENTS` for `<scope>` and optional `[focus]`.

1. Call `mcp__loom-tools__panel_run` with `{ scope, focus }`.
   Capture the returned `runId`, `agents`, and `dispatchInstructions`.

2. Dispatch all 5 panel agents IN PARALLEL via the Task tool in a SINGLE message.
   Use these subagent_types (defined under .claude/agents/):
     - visual-critic
     - a11y-reviewer
     - copy-editor
     - brand-keeper
     - responsive-checker

   Each agent gets prompt:
     "Audit scope `<scope>` (file path) for your specialty. Return JSON: an array of findings
      [{id, agent, severity:'low|medium|high', body, elementSelector|null, suggestedFix|null}].
      Focus (if any): `<focus>`."

3. Collect all returned findings. If any agent failed, include its name in `missingAgents`.

4. Synthesize: dedupe by elementSelector + rule, merge severities (highest wins), flag
   contradictions. Estimate cost ≤ $0.10 p50.

5. Call `mcp__loom-tools__panel_ingest_findings` with the synthesized list.

6. Render the report to the user: count by severity, top findings, missing agents (if any).
   Offer per-finding actions:
     - `/loom:panel apply <findingId>` (calls `panel_apply_fix`)
     - `/loom:panel defer <findingId>` (calls `panel_defer`)
