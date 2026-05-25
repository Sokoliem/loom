import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ulid } from "ulid";
import { execFileNoThrow } from "../utils/execFileNoThrow.js";
import { E } from "../core/errors.js";
import { forgeDir } from "../core/paths.js";
import { projectDb } from "../core/project.js";
import type { ForgeRun } from "../types.js";

export interface ForgeStartInput {
  projectDir: string;
  routePath: string;
  goal: string;
  maxIters?: number;
  maxCostUsd?: number;
}

export interface ForgePlan {
  runId: string;
  worktreePath: string;
  branch: string;
  maxIters: number;
  maxCostUsd: number;
  goal: string;
  routePath: string;
  /** Instructions for the calling Claude session to run the iteration loop in-session. */
  loopInstructions: string;
}

const DEFAULT_MAX_ITERS = 6;
const DEFAULT_MAX_COST = 0.5;

export async function forgeStart(input: ForgeStartInput): Promise<ForgePlan> {
  await assertCleanWorkingTree(input.projectDir);
  const branch = await currentBranch(input.projectDir);
  const runId = ulid();
  const worktreePath = join(forgeDir(input.projectDir), runId);
  mkdirSync(forgeDir(input.projectDir), { recursive: true });

  const worktreeBranch = `loom-forge/${runId}`;
  const r = await execFileNoThrow(
    "git",
    ["worktree", "add", "-b", worktreeBranch, worktreePath, branch],
    input.projectDir,
  );
  if (r.code !== 0) {
    throw E.forgePrecondition(`failed to create worktree: ${r.stderr.trim()}`);
  }

  const maxIters = input.maxIters ?? DEFAULT_MAX_ITERS;
  const maxCostUsd = input.maxCostUsd ?? DEFAULT_MAX_COST;

  projectDb(input.projectDir)
    .prepare(
      `INSERT INTO forge_runs (id, route_path, goal, iterations, final_confidence, cost_usd, outcome, worktree_path, squash_commit_sha, ts)
       VALUES (?, ?, ?, 0, 0, 0, 'running', ?, NULL, ?)`,
    )
    .run(runId, input.routePath, input.goal, worktreePath, Date.now());

  const loopInstructions = renderLoopInstructions({
    runId,
    routePath: input.routePath,
    goal: input.goal,
    worktreePath,
    maxIters,
    maxCostUsd,
    branch,
    worktreeBranch,
  });

  return {
    runId,
    worktreePath,
    branch,
    maxIters,
    maxCostUsd,
    goal: input.goal,
    routePath: input.routePath,
    loopInstructions,
  };
}

export async function forgeSquash(
  projectDir: string,
  runId: string,
): Promise<{ sha: string | null; ok: boolean; stderr: string }> {
  const run = getRun(projectDir, runId);
  if (!run) throw E.notFound("forge_run", runId);
  if (run.outcome === "aborted") {
    return { sha: null, ok: false, stderr: "run was aborted" };
  }
  const branch = await currentBranch(projectDir);
  const r = await execFileNoThrow(
    "git",
    ["merge", "--squash", `loom-forge/${runId}`],
    projectDir,
  );
  if (r.code !== 0) {
    return { sha: null, ok: false, stderr: r.stderr };
  }
  const c = await execFileNoThrow(
    "git",
    [
      "-c",
      "user.email=loom@local",
      "-c",
      "user.name=loom-forge",
      "commit",
      "-m",
      `loom forge: ${run.goal} (run ${runId})`,
    ],
    projectDir,
  );
  if (c.code !== 0) {
    return { sha: null, ok: false, stderr: c.stderr };
  }
  const sha = (await execFileNoThrow("git", ["rev-parse", "HEAD"], projectDir)).stdout.trim();
  projectDb(projectDir)
    .prepare(`UPDATE forge_runs SET outcome = 'converged', squash_commit_sha = ? WHERE id = ?`)
    .run(sha, runId);
  const rm = await execFileNoThrow(
    "git",
    ["worktree", "remove", "--force", run.worktreePath],
    projectDir,
  );
  const cleanupStderr = rm.code === 0 ? "" : rm.stderr;
  return { sha, ok: true, stderr: cleanupStderr };
}

export async function forgeAbort(projectDir: string, runId: string): Promise<void> {
  const run = getRun(projectDir, runId);
  if (!run) throw E.notFound("forge_run", runId);
  const rm = await execFileNoThrow(
    "git",
    ["worktree", "remove", "--force", run.worktreePath],
    projectDir,
  );
  if (rm.code !== 0) {
    // Worktree may already be gone or git may not know about it. Fall back to filesystem cleanup
    // and surface the original stderr in the run row's outcome string so users can diagnose.
    try {
      rmSync(run.worktreePath, { recursive: true, force: true });
    } catch (err) {
      throw new Error(
        `worktree cleanup failed: git stderr='${rm.stderr.trim()}'; fs error='${(err as Error).message}'`,
      );
    }
  }
  projectDb(projectDir).prepare(`UPDATE forge_runs SET outcome = 'aborted' WHERE id = ?`).run(runId);
}

export function recordForgeIteration(
  projectDir: string,
  runId: string,
  iter: number,
  confidence: number,
  costDelta: number,
): void {
  projectDb(projectDir)
    .prepare(
      `UPDATE forge_runs SET iterations = ?, final_confidence = ?, cost_usd = cost_usd + ? WHERE id = ?`,
    )
    .run(iter, confidence, costDelta, runId);
}

export function forgeRunList(projectDir: string, routePath?: string): ForgeRun[] {
  const db = projectDb(projectDir);
  const rows = routePath
    ? (db
        .prepare(`SELECT * FROM forge_runs WHERE route_path = ? ORDER BY ts DESC`)
        .all(routePath) as ForgeRow[])
    : (db.prepare(`SELECT * FROM forge_runs ORDER BY ts DESC`).all() as ForgeRow[]);
  return rows.map(rowToRun);
}

function getRun(projectDir: string, runId: string): ForgeRun | null {
  const row = projectDb(projectDir).prepare(`SELECT * FROM forge_runs WHERE id = ?`).get(runId) as
    | ForgeRow
    | undefined;
  return row ? rowToRun(row) : null;
}

interface ForgeRow {
  id: string;
  route_path: string;
  goal: string;
  iterations: number;
  final_confidence: number;
  cost_usd: number;
  outcome: ForgeRun["outcome"];
  worktree_path: string;
  squash_commit_sha: string | null;
  ts: number;
}

function rowToRun(r: ForgeRow): ForgeRun {
  return {
    id: r.id,
    routePath: r.route_path,
    goal: r.goal,
    iterations: r.iterations,
    finalConfidence: r.final_confidence,
    costUsd: r.cost_usd,
    outcome: r.outcome,
    worktreePath: r.worktree_path,
    squashCommitSha: r.squash_commit_sha,
    ts: r.ts,
  };
}

async function assertCleanWorkingTree(projectDir: string): Promise<void> {
  const r = await execFileNoThrow("git", ["status", "--porcelain"], projectDir);
  if (r.code !== 0) {
    throw E.forgePrecondition(`git unavailable or not a repo: ${r.stderr.trim()}`);
  }
  if (r.stdout.trim().length > 0) {
    throw E.forgePrecondition("working tree is not clean");
  }
}

async function currentBranch(projectDir: string): Promise<string> {
  const r = await execFileNoThrow("git", ["rev-parse", "--abbrev-ref", "HEAD"], projectDir);
  if (r.code !== 0) {
    throw E.forgePrecondition(`git rev-parse failed: ${r.stderr.trim()}`);
  }
  return r.stdout.trim() || "main";
}

function renderLoopInstructions(args: {
  runId: string;
  routePath: string;
  goal: string;
  worktreePath: string;
  maxIters: number;
  maxCostUsd: number;
  branch: string;
  worktreeBranch: string;
}): string {
  return `Forge run ${args.runId} is now scaffolded.

Worktree: ${args.worktreePath}
Branch (worktree): ${args.worktreeBranch}
Base branch: ${args.branch}
Goal: ${args.goal}
Route: ${args.routePath}
Budget: up to ${args.maxIters} iterations, up to $${args.maxCostUsd.toFixed(2)}

Run the loop in-session:
1. For each iteration i in 1..${args.maxIters}:
   a. Render ${args.routePath} via Playwright at 1440x900 and 390x844 inside the worktree.
   b. Dispatch the 'visual-critic-with-goal' agent (Task tool) with goal="${args.goal}".
      The agent proposes ONE targeted edit, ranked best-first.
   c. Apply the edit using Edit/Write tools inside ${args.worktreePath}.
   d. Re-render both viewports.
   e. Dispatch the 'forge-judge' agent (Haiku-default) to score 0..100.
   f. Call forge_iteration_record(runId="${args.runId}", iter=i, confidence=<score>, cost_delta=<usd>).
   g. If confidence < 60 and i > 1: revert worktree HEAD; retry once with a different edit.
   h. If confidence >= 90: break.
2. On loop exit:
   - confidence >= 75: prompt user to squash via /loom:forge squash ${args.runId}.
   - else: prompt user to abort via /loom:forge abort ${args.runId}, or to keep the worktree for manual review.

User can always abort with /loom:forge abort ${args.runId}.`;
}
