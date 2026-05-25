import { z, type ZodTypeAny } from "zod";
import {
  componentCreate,
  componentDelete,
  componentGet,
  componentList,
  componentUpdate,
} from "../core/components.js";
import { requireCurrent, projectArchive, projectCreate, projectCurrent, projectList, projectOpen } from "../core/project.js";
import { routeCreate, routeDelete, routeGet, routeList, routeUpdate, type RouteMeta } from "../core/routes.js";
import { getToken, listTokens, resolveAll, loadTokens, setToken } from "../core/tokens.js";
import {
  branchCreate,
  branchList,
  buildManifest,
  versionDiff,
  versionGet,
  versionList,
  versionRestore,
  versionSnapshot,
} from "../core/version.js";
import { runValidation, type ValidationKind } from "../validate/index.js";
import { runExport } from "../export/index.js";
import { planPanelRun, ingestPanelFindings, recordPanelDecision } from "../panel/index.js";
import { forgeAbort, forgeRunList, forgeSquash, forgeStart, recordForgeIteration } from "../forge/index.js";
import { reviewCreate, reviewGet, reviewList, reviewResolve } from "../reviews/index.js";
import { runDoctor } from "../doctor/index.js";
import { readDaemonStatus, startDaemonDetached, stopDaemonDetached } from "./daemon-control.js";
import { daemonFetch } from "./daemon-fetch.js";

export interface ToolDef<TSchema extends ZodTypeAny = ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: object;
  schema: TSchema;
  handler: (args: unknown) => Promise<unknown> | unknown;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDef>();

  add<TSchema extends ZodTypeAny>(
    name: string,
    description: string,
    schema: TSchema,
    handler: (args: z.infer<TSchema>) => Promise<unknown> | unknown,
  ): void {
    const inputSchema = zodToJsonSchema(schema);
    this.tools.set(name, {
      name,
      description,
      inputSchema,
      schema,
      handler: (args) => {
        const parsed = schema.parse(args ?? {});
        return handler(parsed);
      },
    });
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name);
  }

  list(): Array<{ name: string; description: string; inputSchema: object }> {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }
}

function projectPath(name?: string): string {
  if (name) {
    const rec = projectOpen(name);
    return rec.path;
  }
  return requireCurrent().path;
}

export function registerAllTools(): ToolRegistry {
  const r = new ToolRegistry();

  // ------------------------------------------------------------- Project
  r.add(
    "project_create",
    "Create a new loom project with scaffolded tokens, components, routes, and git init",
    z.object({
      name: z.string(),
      path: z.string().optional(),
      template: z.enum(["shadcn-starter", "blank"]).optional(),
    }),
    async (input) => projectCreate(input),
  );

  r.add(
    "project_open",
    "Open a project by name or id, making it the current project",
    z.object({ name: z.string() }),
    (input) => projectOpen(input.name),
  );

  r.add("project_list", "List all known projects", z.object({}), () => projectList());

  r.add(
    "project_archive",
    "Archive a project by id",
    z.object({ id: z.string() }),
    (input) => {
      projectArchive(input.id);
      return { ok: true };
    },
  );

  r.add("project_current", "Return the currently open project, or null", z.object({}), () =>
    projectCurrent(),
  );

  // ------------------------------------------------------------- Tokens
  r.add(
    "token_get",
    "Get a resolved token value",
    z.object({ ref: z.string(), theme: z.string().optional(), project: z.string().optional() }),
    (input) => ({ ref: input.ref, value: getToken(projectPath(input.project), input.ref) }),
  );

  r.add(
    "token_set",
    "Set a token (creates the namespace YAML if missing). Re-validates cycle-freedom.",
    z.object({
      ref: z.string(),
      value: z.string(),
      theme: z.string().optional(),
      project: z.string().optional(),
    }),
    (input) => {
      setToken(projectPath(input.project), input.ref, input.value);
      return { ok: true, ref: input.ref };
    },
  );

  r.add(
    "token_list",
    "List tokens, optionally filtered by namespace",
    z.object({ namespace: z.string().optional(), project: z.string().optional() }),
    (input) => listTokens(projectPath(input.project), input.namespace),
  );

  r.add(
    "token_resolve_all",
    "Resolve every token. Throws on cycles or missing refs.",
    z.object({ project: z.string().optional() }),
    (input) => Object.fromEntries(resolveAll(loadTokens(projectPath(input.project)).flat)),
  );

  // ------------------------------------------------------------- Components
  r.add(
    "component_create",
    "Create a component directory with .tsx, .spec.md, .tokens.yaml, .a11y.yaml, .stories.mdx",
    z.object({
      name: z.string(),
      description: z.string().optional(),
      uses_tokens: z.array(z.string()).optional(),
      jsx: z.string().optional(),
      project: z.string().optional(),
    }),
    (input) =>
      componentCreate(projectPath(input.project), {
        name: input.name,
        description: input.description,
        uses_tokens: input.uses_tokens,
        jsx: input.jsx,
      }),
  );

  r.add(
    "component_get",
    "Get a component record",
    z.object({ name: z.string(), project: z.string().optional() }),
    (input) => componentGet(projectPath(input.project), input.name),
  );

  r.add(
    "component_list",
    "List components, optionally filtered by substring",
    z.object({ filter: z.string().optional(), project: z.string().optional() }),
    (input) => componentList(projectPath(input.project), input.filter),
  );

  r.add(
    "component_update",
    "Update a component. Refuses (E_HOOK_ORDER_CHANGE) if a hook-order shift would cost component state on HMR — re-call with ack_state_loss=true to proceed.",
    z.object({
      name: z.string(),
      jsx: z.string().optional(),
      description: z.string().optional(),
      uses_tokens: z.array(z.string()).optional(),
      ack_state_loss: z.boolean().optional(),
      project: z.string().optional(),
    }),
    (input) =>
      componentUpdate(projectPath(input.project), input.name, {
        jsx: input.jsx,
        description: input.description,
        uses_tokens: input.uses_tokens,
        ack_state_loss: input.ack_state_loss,
      }),
  );

  r.add(
    "component_delete",
    "Delete a component",
    z.object({ name: z.string(), project: z.string().optional() }),
    (input) => {
      componentDelete(projectPath(input.project), input.name);
      return { ok: true };
    },
  );

  r.add(
    "component_snapshot",
    "Take a render snapshot of a component (requires Playwright; stub returns metadata only here)",
    z.object({
      name: z.string(),
      viewport: z.string().optional(),
      project: z.string().optional(),
    }),
    (input) => ({
      ok: true,
      note: "snapshot rendering requires Playwright; ask the user to run `pnpm exec playwright install chromium`",
      component: input.name,
      viewport: input.viewport ?? "desktop",
    }),
  );

  r.add(
    "component_promote",
    "Promote inline JSX into a component file",
    z.object({
      from_artifact: z.string(),
      name: z.string(),
      project: z.string().optional(),
    }),
    (input) =>
      componentCreate(projectPath(input.project), {
        name: input.name,
        jsx: input.from_artifact,
      }),
  );

  // ------------------------------------------------------------- Routes
  const routeMetaSchema: z.ZodType<RouteMeta> = z.object({
    title: z.string().optional(),
    state: z.enum(["draft", "in-review", "approved"]).optional(),
    description: z.string().optional(),
    data: z.string().optional(),
  });

  r.add(
    "route_create",
    "Create a route file. Path uses forward-slash form (e.g., / or /pricing).",
    z.object({
      path: z.string(),
      body: z.string(),
      meta: routeMetaSchema.optional(),
      project: z.string().optional(),
    }),
    (input) =>
      routeCreate(projectPath(input.project), input.path, input.body, input.meta),
  );

  r.add(
    "route_get",
    "Get a route record",
    z.object({ path: z.string(), project: z.string().optional() }),
    (input) => routeGet(projectPath(input.project), input.path),
  );

  r.add(
    "route_list",
    "List routes",
    z.object({ project: z.string().optional() }),
    (input) => routeList(projectPath(input.project)),
  );

  r.add(
    "route_update",
    "Update a route's body or meta",
    z.object({
      path: z.string(),
      body: z.string().optional(),
      meta: routeMetaSchema.optional(),
      project: z.string().optional(),
    }),
    (input) =>
      routeUpdate(projectPath(input.project), input.path, {
        body: input.body,
        meta: input.meta,
      }),
  );

  r.add(
    "route_delete",
    "Delete a route",
    z.object({ path: z.string(), project: z.string().optional() }),
    (input) => {
      routeDelete(projectPath(input.project), input.path);
      return { ok: true };
    },
  );

  r.add(
    "route_screenshot",
    "Render a route at a viewport (requires Playwright; returns metadata stub if absent)",
    z.object({
      path: z.string(),
      viewport: z.string().optional(),
      theme: z.string().optional(),
      project: z.string().optional(),
    }),
    (input) => ({
      ok: true,
      note: "screenshot requires Playwright + a running Vite preview; instruct the user to start a Vite dev server",
      path: input.path,
      viewport: input.viewport ?? "desktop",
      theme: input.theme ?? "light",
    }),
  );

  // ------------------------------------------------------------- Versions
  r.add(
    "version_snapshot",
    "Create a new version snapshot of the project",
    z.object({
      branch: z.string().optional(),
      label: z.string().optional(),
      message: z.string().optional(),
      project: z.string().optional(),
    }),
    (input) =>
      versionSnapshot(projectPath(input.project), input.branch ?? "main", {
        label: input.label,
        message: input.message,
        createdBy: "user",
      }),
  );

  r.add(
    "version_list",
    "List versions, newest first",
    z.object({ limit: z.number().int().min(1).max(500).optional(), project: z.string().optional() }),
    (input) => versionList(projectPath(input.project), input.limit ?? 50),
  );

  r.add(
    "version_diff",
    "Diff two versions",
    z.object({ from: z.string(), to: z.string(), project: z.string().optional() }),
    (input) => versionDiff(projectPath(input.project), input.from, input.to),
  );

  r.add(
    "version_get",
    "Get a version record",
    z.object({ id: z.string(), project: z.string().optional() }),
    (input) => versionGet(projectPath(input.project), input.id),
  );

  r.add(
    "version_restore",
    "Restore a prior version. 'safe' stages files under .loom/restore/<id>/ for review (no working-tree overwrite). 'force' overwrites the working tree from the version's blob store.",
    z.object({
      id: z.string(),
      mode: z.enum(["safe", "force"]).default("safe"),
      project: z.string().optional(),
    }),
    (input) => versionRestore(projectPath(input.project), input.id, input.mode),
  );

  r.add(
    "branch_create",
    "Create a new branch from another",
    z.object({ name: z.string(), from: z.string().optional(), project: z.string().optional() }),
    (input) => branchCreate(projectPath(input.project), input.name, input.from),
  );

  r.add(
    "branch_list",
    "List all branches",
    z.object({ project: z.string().optional() }),
    (input) => branchList(projectPath(input.project)),
  );

  r.add(
    "branch_switch",
    "Switch to a branch (via git checkout in the project working tree)",
    z.object({ name: z.string(), project: z.string().optional() }),
    async (input) => {
      const { execFileNoThrow } = await import("../utils/execFileNoThrow.js");
      const r = await execFileNoThrow("git", ["checkout", input.name], projectPath(input.project));
      return { ok: r.code === 0, stderr: r.stderr };
    },
  );

  r.add(
    "branch_merge",
    "Merge one branch into another via git merge. On conflict, returns the per-file list so the caller can drive resolution.",
    z.object({ from: z.string(), into: z.string(), project: z.string().optional() }),
    async (input) => {
      const { execFileNoThrow } = await import("../utils/execFileNoThrow.js");
      const dir = projectPath(input.project);
      const co = await execFileNoThrow("git", ["checkout", input.into], dir);
      if (co.code !== 0) return { ok: false, stderr: co.stderr, conflicts: [] };
      const m = await execFileNoThrow("git", ["merge", "--no-ff", "--no-edit", input.from], dir);
      if (m.code === 0) return { ok: true, stderr: "", conflicts: [] };
      const status = await execFileNoThrow(
        "git",
        ["diff", "--name-only", "--diff-filter=U"],
        dir,
      );
      const conflicts = status.stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        ok: false,
        stderr: m.stderr,
        conflicts,
        hint:
          conflicts.length > 0
            ? "resolve each conflict file then run `git add <file>` and `git commit --no-edit`"
            : "merge failed without conflict markers; inspect git output",
      };
    },
  );

  // ------------------------------------------------------------- Validation
  r.add(
    "validate",
    "Run validations: axe, token-lint, ds-lint, deterministic-lint",
    z.object({
      scope: z.enum(["project", "route", "component"]).default("project"),
      scope_id: z.string().optional(),
      kinds: z.array(z.enum(["axe", "token-lint", "ds-lint", "deterministic-lint"])).default([
        "token-lint",
        "ds-lint",
        "deterministic-lint",
      ]),
      axe_url: z.string().optional(),
      project: z.string().optional(),
    }),
    async (input) =>
      runValidation({
        projectDir: projectPath(input.project),
        scope: input.scope,
        scopeId: input.scope_id,
        kinds: input.kinds as ValidationKind[],
        axe: input.axe_url ? { url: input.axe_url } : undefined,
      }),
  );

  // ------------------------------------------------------------- Panel
  r.add(
    "panel_run",
    "Plan a 5-agent panel run. Returns dispatch instructions for the calling Claude session to execute via Task tool in parallel.",
    z.object({
      scope: z.string(),
      agents: z.array(z.string()).optional(),
      focus: z.string().optional(),
      project: z.string().optional(),
    }),
    (input) =>
      planPanelRun({
        projectDir: projectPath(input.project),
        scope: input.scope,
        agents: input.agents,
        focus: input.focus,
      }),
  );

  r.add(
    "panel_ingest_findings",
    "Persist panel findings returned from parallel Task agents",
    z.object({
      runId: z.string(),
      scope: z.string(),
      findings: z.array(
        z.object({
          id: z.string(),
          agent: z.string(),
          severity: z.enum(["low", "medium", "high"]),
          body: z.string(),
          elementSelector: z.string().nullable(),
          suggestedFix: z.string().nullable(),
        }),
      ),
      missingAgents: z.array(z.string()).optional(),
      costUsd: z.number().optional(),
      durationMs: z.number().optional(),
      project: z.string().optional(),
    }),
    (input) =>
      ingestPanelFindings({
        projectDir: projectPath(input.project),
        runId: input.runId,
        scope: input.scope,
        findings: input.findings,
        missingAgents: input.missingAgents,
        costUsd: input.costUsd,
        durationMs: input.durationMs,
      }),
  );

  r.add(
    "panel_apply_fix",
    "Mark a panel finding as applied (after the calling session has applied the fix)",
    z.object({ findingId: z.string(), reason: z.string().optional(), project: z.string().optional() }),
    (input) => {
      recordPanelDecision({
        projectDir: projectPath(input.project),
        findingId: input.findingId,
        action: "applied",
        reason: input.reason,
      });
      return { ok: true };
    },
  );

  r.add(
    "panel_defer",
    "Mark a panel finding as deferred",
    z.object({ findingId: z.string(), reason: z.string().optional(), project: z.string().optional() }),
    (input) => {
      recordPanelDecision({
        projectDir: projectPath(input.project),
        findingId: input.findingId,
        action: "deferred",
        reason: input.reason,
      });
      return { ok: true };
    },
  );

  // ------------------------------------------------------------- Forge
  r.add(
    "forge_run",
    "Plan a forge run: precondition-check working tree, create git worktree, return iteration instructions",
    z.object({
      route_path: z.string(),
      goal: z.string(),
      max_iters: z.number().int().min(1).max(20).optional(),
      max_cost_usd: z.number().positive().optional(),
      project: z.string().optional(),
    }),
    async (input) =>
      forgeStart({
        projectDir: projectPath(input.project),
        routePath: input.route_path,
        goal: input.goal,
        maxIters: input.max_iters,
        maxCostUsd: input.max_cost_usd,
      }),
  );

  r.add(
    "forge_iteration_record",
    "Record one forge iteration's outcome",
    z.object({
      runId: z.string(),
      iter: z.number().int().min(1),
      confidence: z.number().int().min(0).max(100),
      cost_delta: z.number().min(0).default(0),
      project: z.string().optional(),
    }),
    (input) => {
      recordForgeIteration(
        projectPath(input.project),
        input.runId,
        input.iter,
        input.confidence,
        input.cost_delta,
      );
      return { ok: true };
    },
  );

  r.add(
    "forge_squash",
    "Squash a converged forge worktree into the base branch as one commit",
    z.object({ runId: z.string(), project: z.string().optional() }),
    (input) => forgeSquash(projectPath(input.project), input.runId),
  );

  r.add(
    "forge_abort",
    "Abort a forge run, removing its worktree",
    z.object({ runId: z.string(), project: z.string().optional() }),
    async (input) => {
      await forgeAbort(projectPath(input.project), input.runId);
      return { ok: true };
    },
  );

  r.add(
    "forge_list",
    "List forge runs, optionally filtered by route_path",
    z.object({ route_path: z.string().optional(), project: z.string().optional() }),
    (input) => forgeRunList(projectPath(input.project), input.route_path),
  );

  // ------------------------------------------------------------- Reviews
  r.add(
    "review_threads_list",
    "List review threads (optionally by route/status)",
    z.object({
      routePath: z.string().optional(),
      status: z.enum(["open", "resolved", "rejected"]).optional(),
      project: z.string().optional(),
    }),
    (input) =>
      reviewList(projectPath(input.project), {
        routePath: input.routePath,
        status: input.status,
      }),
  );

  r.add(
    "review_thread_get",
    "Get one review thread",
    z.object({ id: z.string(), project: z.string().optional() }),
    (input) => reviewGet(projectPath(input.project), input.id),
  );

  r.add(
    "review_thread_create",
    "Create a new review thread (used by panel ingest + stakeholder feedback bridge)",
    z.object({
      routePath: z.string(),
      elementSelector: z.string(),
      viewport: z.string().default("desktop"),
      author: z.string().default("local"),
      body: z.string(),
      source: z.enum(["stakeholder", "panel", "self"]).default("self"),
      severity: z.enum(["low", "medium", "high"]).optional(),
      agent: z.string().optional(),
      project: z.string().optional(),
    }),
    (input) => {
      const dir = projectPath(input.project);
      return reviewCreate({
        projectDir: dir,
        routePath: input.routePath,
        elementSelector: input.elementSelector,
        viewport: input.viewport,
        versionId: buildManifest(dir).hash,
        author: input.author,
        body: input.body,
        source: input.source,
        severity: input.severity,
        agent: input.agent,
      });
    },
  );

  r.add(
    "review_thread_resolve",
    "Resolve or reject a review thread",
    z.object({
      id: z.string(),
      resolution: z.enum(["resolved", "rejected"]).default("resolved"),
      project: z.string().optional(),
    }),
    (input) => reviewResolve(projectPath(input.project), input.id, input.resolution),
  );

  // ------------------------------------------------------------- Export
  r.add(
    "export",
    "Run an export target (css-vars, tailwind, style-dictionary, react-shadcn, storybook-mdx, route-map-md, static-bundle)",
    z.object({
      target: z.enum([
        "css-vars",
        "tailwind",
        "style-dictionary",
        "react-shadcn",
        "storybook-mdx",
        "route-map-md",
        "static-bundle",
      ]),
      out_dir: z.string().optional(),
      project: z.string().optional(),
    }),
    (input) => runExport(projectPath(input.project), input.target, input.out_dir),
  );

  // ------------------------------------------------------------- Server / diagnostics
  r.add("server_status", "Daemon status snapshot (does not start the daemon)", z.object({}), () => ({
    ok: true,
    pid: process.pid,
    cwd: process.cwd(),
    project: projectCurrent(),
    daemon: readDaemonStatus(),
  }));

  r.add(
    "daemon_start",
    "Start the loom HTTP+WS daemon as a detached process. Returns the studio URL.",
    z.object({}),
    async () => startDaemonDetached(),
  );

  r.add(
    "daemon_stop",
    "Stop the running loom daemon (if any).",
    z.object({}),
    async () => stopDaemonDetached(),
  );

  // -- Terminal (claude PTY mirrored to the studio chrome) ---------------
  r.add(
    "terminal_start",
    "Start a claude PTY session for the project, mirrored to the studio chrome via @celestial/forge + @celestial/lens.",
    z.object({ projectId: z.string().optional() }),
    async (input) => {
      const id = input.projectId ?? projectCurrent()?.id;
      if (!id) throw new Error("no project open; pass projectId or open one first");
      return await daemonFetch("/api/loom/terminal/start", { method: "POST", body: { projectId: id } });
    },
  );

  r.add(
    "terminal_stop",
    "Stop the claude PTY session for the project.",
    z.object({ projectId: z.string().optional() }),
    async (input) => {
      const id = input.projectId ?? projectCurrent()?.id;
      if (!id) return { stopped: false };
      return await daemonFetch("/api/loom/terminal/stop", { method: "POST", body: { projectId: id } });
    },
  );

  r.add(
    "terminal_status",
    "Get current claude PTY session status for the project.",
    z.object({ projectId: z.string().optional() }),
    async (input) => {
      const id = input.projectId ?? projectCurrent()?.id;
      if (!id) return { running: false };
      const q = `?projectId=${encodeURIComponent(id)}`;
      return await daemonFetch(`/api/loom/terminal/status${q}`);
    },
  );

  r.add(
    "stage_url",
    "Compute the stage URL for the current project + route + viewport (assumes daemon on LOOM_PORT or 5174)",
    z.object({
      routePath: z.string().optional(),
      viewport: z.string().optional(),
      theme: z.string().optional(),
      project: z.string().optional(),
    }),
    (input) => {
      const cur = requireCurrent();
      const port = process.env.LOOM_PORT ?? "5174";
      const path = input.routePath ?? "/";
      return {
        url: `http://127.0.0.1:${port}/loom/preview/${cur.id}${path}?viewport=${input.viewport ?? "desktop"}&theme=${input.theme ?? "light"}`,
        projectId: cur.id,
      };
    },
  );

  r.add(
    "stage_open",
    "Return a clickable stage URL (the caller is responsible for opening it; environments differ)",
    z.object({ routePath: z.string().optional(), project: z.string().optional() }),
    (input) => {
      const cur = requireCurrent();
      const port = process.env.LOOM_PORT ?? "5174";
      return {
        url: `http://127.0.0.1:${port}/loom/preview/${cur.id}${input.routePath ?? "/"}`,
      };
    },
  );

  r.add("doctor", "Run loom doctor: Node version, git, Playwright, project health", z.object({}), () =>
    runDoctor(),
  );

  r.add(
    "logs",
    "Return recent telemetry events (placeholder — local SQLite ring buffer)",
    z.object({
      since: z.number().optional(),
      level: z.string().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    }),
    () => ({ events: [] }),
  );

  return r;
}

/** Minimal zod → JSON schema converter (enough for tool input schemas). */
function zodToJsonSchema(schema: ZodTypeAny): object {
  return zodNodeToSchema(schema);
}

function zodNodeToSchema(node: ZodTypeAny): object {
  const def = (node as unknown as { _def: { typeName: string } })._def;
  switch (def.typeName) {
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return {
        type: "string",
        enum: ((def as unknown as { values: string[] }).values ??
          (def as unknown as { entries: string[] }).entries) as string[],
      };
    case "ZodArray":
      return {
        type: "array",
        items: zodNodeToSchema((def as unknown as { type: ZodTypeAny }).type),
      };
    case "ZodObject": {
      const shape = (node as unknown as { shape: Record<string, ZodTypeAny> }).shape;
      const properties: Record<string, object> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = zodNodeToSchema(v);
        if (!isOptional(v)) required.push(k);
      }
      return required.length > 0
        ? { type: "object", properties, required }
        : { type: "object", properties };
    }
    case "ZodOptional":
      return zodNodeToSchema((def as unknown as { innerType: ZodTypeAny }).innerType);
    case "ZodDefault":
      return zodNodeToSchema((def as unknown as { innerType: ZodTypeAny }).innerType);
    case "ZodNullable":
      return zodNodeToSchema((def as unknown as { innerType: ZodTypeAny }).innerType);
    case "ZodUnion":
      return {
        oneOf: ((def as unknown as { options: ZodTypeAny[] }).options).map(zodNodeToSchema),
      };
    default:
      return {};
  }
}

function isOptional(node: ZodTypeAny): boolean {
  const def = (node as unknown as { _def: { typeName: string } })._def;
  return def.typeName === "ZodOptional" || def.typeName === "ZodDefault";
}
