import { ulid } from "ulid";
import { projectDb } from "../core/project.js";
import { buildManifest } from "../core/version.js";
import type { PanelFinding, PanelReport } from "../types.js";

export const DEFAULT_AGENTS = [
  "visual-critic",
  "a11y-reviewer",
  "copy-editor",
  "brand-keeper",
  "responsive-checker",
] as const;

export type PanelAgent = (typeof DEFAULT_AGENTS)[number] | string;

export interface PanelRunInput {
  projectDir: string;
  scope: string;
  agents?: PanelAgent[];
  focus?: string;
}

export interface PanelDispatchPlan {
  runId: string;
  scope: string;
  agents: PanelAgent[];
  focus: string | null;
  /** Instructions for the calling Claude session to dispatch agents in parallel via Task tool. */
  dispatchInstructions: string;
}

export function planPanelRun(input: PanelRunInput): PanelDispatchPlan {
  const runId = ulid();
  const agents = (input.agents ?? Array.from(DEFAULT_AGENTS)).slice(0, 5);
  return {
    runId,
    scope: input.scope,
    agents,
    focus: input.focus ?? null,
    dispatchInstructions: renderDispatch({
      runId,
      scope: input.scope,
      agents,
      focus: input.focus ?? null,
    }),
  };
}

export interface IngestPanelFindingsInput {
  projectDir: string;
  runId: string;
  scope: string;
  findings: PanelFinding[];
  missingAgents?: string[];
  costUsd?: number;
  durationMs?: number;
}

export function ingestPanelFindings(input: IngestPanelFindingsInput): PanelReport {
  const report: PanelReport = {
    ts: Date.now(),
    scope: input.scope,
    agents: dedupeAgents(input.findings.map((f) => f.agent)),
    findings: input.findings,
    missingAgents: input.missingAgents ?? [],
    costUsd: input.costUsd ?? 0,
    durationMs: input.durationMs ?? 0,
  };
  const versionId = buildManifest(input.projectDir).hash;
  projectDb(input.projectDir)
    .prepare(
      `INSERT INTO validation_runs (id, version_id, route_path, kind, report_json, ts) VALUES (?, ?, ?, 'panel', ?, ?)`,
    )
    .run(input.runId, versionId, input.scope, JSON.stringify(report), report.ts);
  return report;
}

export interface PanelDecisionInput {
  projectDir: string;
  findingId: string;
  action: "applied" | "deferred" | "rejected";
  reason?: string;
}

export function recordPanelDecision(input: PanelDecisionInput): void {
  const db = projectDb(input.projectDir);
  const row = db
    .prepare(`SELECT id, report_json FROM validation_runs WHERE kind = 'panel' ORDER BY ts DESC`)
    .all() as Array<{ id: string; report_json: string }>;
  for (const r of row) {
    const report = JSON.parse(r.report_json) as PanelReport;
    const idx = report.findings.findIndex((f) => f.id === input.findingId);
    if (idx === -1) continue;
    const updated: PanelReport = {
      ...report,
      findings: report.findings.map((f, i) =>
        i === idx
          ? ({
              ...f,
              body: `${f.body}\n[decision: ${input.action}${input.reason ? ` — ${input.reason}` : ""}]`,
            } as PanelFinding)
          : f,
      ),
    };
    db.prepare(`UPDATE validation_runs SET report_json = ? WHERE id = ?`).run(
      JSON.stringify(updated),
      r.id,
    );
    return;
  }
  throw Object.assign(new Error(`panel finding '${input.findingId}' not found`), {
    code: "E_FINDING_NOT_FOUND",
    hint: "list panel runs via the validation_runs table; the id is the finding id, not the run id",
  });
}

function renderDispatch(args: {
  runId: string;
  scope: string;
  agents: string[];
  focus: string | null;
}): string {
  const list = args.agents.map((a) => `   - ${a}`).join("\n");
  return `Panel run ${args.runId} is ready.

Scope: ${args.scope}
Agents: ${args.agents.length}
${list}
${args.focus ? `Focus: ${args.focus}\n` : ""}
Dispatch each agent in parallel via the Task tool in a SINGLE message (5 parallel Task calls).
Each agent gets:
  - The scope path: ${args.scope}
  - The focus (if any): ${args.focus ?? "(none)"}
  - The project root and loom.yaml

Synthesis (after all return):
  - Dedupe findings by element + rule
  - Merge severities (highest wins)
  - Surface contradictions explicitly
  - Call panel_ingest_findings(runId="${args.runId}", scope="${args.scope}", findings=[...]) to persist.

If an agent dispatch fails, include it in 'missingAgents' on the ingest payload.`;
}

function dedupeAgents(list: string[]): string[] {
  return Array.from(new Set(list));
}
