import { ulid } from "ulid";
import { projectDb } from "../core/project.js";
import { buildManifest } from "../core/version.js";
import { runAxe, type AxeOptions } from "./axe.js";
import { deterministicSourceLint, tokenUsageLint, type LintFinding } from "./lints.js";

export type ValidationKind = "axe" | "token-lint" | "ds-lint" | "deterministic-lint";

export interface ValidationRequest {
  projectDir: string;
  scope: "project" | "route" | "component";
  scopeId?: string;
  kinds: ValidationKind[];
  axe?: AxeOptions;
}

export interface ValidationResult {
  kind: ValidationKind;
  findings: LintFinding[];
  ts: number;
  meta?: Record<string, unknown>;
}

export async function runValidation(req: ValidationRequest): Promise<ValidationResult[]> {
  const out: ValidationResult[] = [];
  const versionId = buildManifest(req.projectDir).hash;
  for (const kind of req.kinds) {
    const result = await runOne(req, kind);
    out.push(result);
    persist(req.projectDir, versionId, req.scopeId ?? null, kind, result);
  }
  return out;
}

async function runOne(req: ValidationRequest, kind: ValidationKind): Promise<ValidationResult> {
  const ts = Date.now();
  if (kind === "token-lint" || kind === "ds-lint") {
    return { kind, findings: tokenUsageLint({ projectDir: req.projectDir }), ts };
  }
  if (kind === "deterministic-lint") {
    return { kind, findings: deterministicSourceLint({ projectDir: req.projectDir }), ts };
  }
  if (kind === "axe") {
    const result = await runAxe(req.axe ?? {});
    return {
      kind,
      findings: result.findings,
      ts,
      meta: { available: result.available, reason: result.reason },
    };
  }
  return { kind, findings: [], ts, meta: { error: "unknown kind" } };
}

function persist(
  projectDir: string,
  versionId: string,
  routePath: string | null,
  kind: ValidationKind,
  result: ValidationResult,
): void {
  const db = projectDb(projectDir);
  db.prepare(
    `INSERT INTO validation_runs (id, version_id, route_path, kind, report_json, ts) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(ulid(), versionId, routePath, kind, JSON.stringify(result), result.ts);
}
