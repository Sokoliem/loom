import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { serverDir, serverPidPath, serverPortPath } from "./core/paths.js";
import { startWatcher, type WatchEvent, type WatcherHandle } from "./core/watcher.js";
import {
  projectArchive,
  projectCreate,
  projectCurrent,
  projectList,
  projectOpen,
  projectUpdate,
  requireCurrent,
} from "./core/project.js";
import {
  buildManifest,
  versionList,
  versionRestoreWithAutoSnapshot,
  versionSnapshot,
} from "./core/version.js";
import { routeList } from "./core/routes.js";
import { componentList } from "./core/components.js";
import { loadTokens, resolveValue, setToken } from "./core/tokens.js";
import { captureRouteScreenshot } from "./screenshot/index.js";
import { readCanvas, writeCanvas, type CanvasState } from "./core/canvas.js";
import { gitStatus } from "./core/git.js";
import { activityBus, activityInsert, activityList } from "./core/activity.js";
import * as telemetry from "./core/telemetry.js";
import { config } from "./config.js";
import type { ActivityEvent, ActivityKind } from "./types.js";
import { ensureStudio, fullReload, stopAllStudios } from "./studio/server.js";
import { renderStudioChrome } from "./studio/chrome.js";
import {
  ensureClaudeSession,
  getClaudeSession,
  sessionStatusAsync,
  stopAllClaudeSessions,
  stopClaudeSession,
} from "./pty/runtime.js";
import { attachMirror } from "./pty/mirror.js";

const DEFAULT_PORT = Number(process.env.LOOM_PORT ?? 5174);

export interface DaemonOptions {
  port?: number;
}

export interface DaemonHandle {
  url: string;
  port: number;
  stop: () => Promise<void>;
}

export async function startDaemon(opts: DaemonOptions = {}): Promise<DaemonHandle> {
  ensureSingleton();
  const secret = ensureDaemonSecret();

  const app = Fastify({ logger: false });
  await app.register(websocket);

  app.addHook("preHandler", async (req, reply) => {
    if (req.method === "GET" && req.url.startsWith("/api/loom/healthz")) return;
    if (req.url.startsWith("/api/loom/ws")) return;
    // Block cross-origin browser requests so a malicious tab can't reach the daemon.
    const origin = req.headers.origin as string | undefined;
    if (origin && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      reply.code(403);
      return reply.send({ error: "cross-origin denied" });
    }
    // Mutating endpoints require the shared secret. GETs (read-only) only require localhost origin.
    if (req.method !== "GET") {
      const provided = (req.headers["x-loom-secret"] as string | undefined) ?? "";
      if (!tokenEquals(provided, secret)) {
        reply.code(401);
        return reply.send({ error: "missing or invalid X-Loom-Secret" });
      }
    }
  });

  const watchers = new Map<string, WatcherHandle>();
  const sockets = new Set<{ send: (data: string) => void; close: () => void }>();

  function broadcast(event: WatchEvent | { kind: string; [k: string]: unknown }): void {
    const payload = JSON.stringify({ ts: Date.now(), ...event });
    for (const s of sockets) {
      try {
        s.send(payload);
      } catch {
        // ignore broken sockets; cleaned up on close
      }
    }
  }

  // Per-(project, file) dedupe window for activity events. Save-storms from
  // formatter-on-save or build watchers can fire the same path multiple times in
  // <250ms; we coalesce to a single activity entry per (kind, path) per window.
  const activityDedupe = new Map<string, number>();
  const ACTIVITY_DEDUPE_MS = 250;
  function maybeEmitFileActivity(projectId: string, path: string): void {
    const key = `${projectId}|${path}`;
    const now = Date.now();
    const prev = activityDedupe.get(key);
    if (prev !== undefined && now - prev < ACTIVITY_DEDUPE_MS) return;
    activityDedupe.set(key, now);
    if (activityDedupe.size > 5000) {
      // Bound the map; drop oldest half.
      const entries = Array.from(activityDedupe.entries()).sort((a, b) => a[1] - b[1]);
      for (let i = 0; i < entries.length / 2; i++) activityDedupe.delete(entries[i]![0]);
    }
    try {
      activityInsert({
        projectId,
        kind: classifyFileKind(path),
        subkind: "changed",
        title: shortFilename(path),
        refPath: path,
      });
    } catch {
      // best-effort; never block the watcher
    }
  }

  function ensureWatch(projectDir: string): void {
    if (watchers.has(projectDir)) return;
    const handle = startWatcher(projectDir, (ev) => {
      const proj = projectList().find((p) => p.path === projectDir);
      if (ev.kind === "manifest_changed") {
        try {
          const v = versionSnapshot(projectDir, "main", { createdBy: "auto" });
          broadcast({ kind: "version_snapshot", projectDir, versionId: v.id });
          if (proj && config.featureProjectMgmt) {
            try {
              activityInsert({
                projectId: proj.id,
                kind: "version",
                subkind: "auto_snapshot",
                title: `auto-snapshot ${v.id.slice(0, 10)}`,
                refId: v.id,
              });
            } catch {
              /* never block the watcher */
            }
          }
        } catch {
          // ignore — partial states during edit storms
        }
      }
      // Token changes don't go through the Vite module graph, so push a full
      // reload at the studio iframe. Vite handles route/component HMR itself.
      const path = (ev as { path?: string }).path ?? "";
      if (/[\\/]tokens[\\/]/.test(path)) {
        if (proj) fullReload(proj.id);
        broadcast({ kind: "token_changed", projectDir, path });
      }
      if (proj && path && config.featureProjectMgmt) {
        maybeEmitFileActivity(proj.id, path);
      }
      broadcast({ projectDir, ...ev });
    });
    watchers.set(projectDir, handle);
  }

  app.get("/api/loom/healthz", async () => ({
    status: "ok",
    ts: Date.now(),
    version: pkgVersion(),
  }));

  app.get("/api/loom/projects", async () => ({ projects: projectList() }));

  app.get("/api/loom/current", async () => ({ project: projectCurrent() }));

  app.get<{ Querystring: { projectId?: string } }>(
    "/api/loom/manifest",
    async (req, reply) => {
      const cur = projectCurrent();
      if (!cur) {
        reply.code(404);
        return { error: "no project open" };
      }
      ensureWatch(cur.path);
      return buildManifest(cur.path);
    },
  );

  app.post<{ Body: { path: string } }>(
    "/api/loom/watch",
    async (req, reply) => {
      const path = req.body?.path;
      if (!path || !existsSync(path)) {
        reply.code(400);
        return { error: "path is required and must exist" };
      }
      // Constrain to a known project path so an authenticated attacker can't watch arbitrary dirs.
      const known = new Set(projectList().map((p) => p.path));
      if (!known.has(path)) {
        reply.code(403);
        return { error: "path is not a registered project" };
      }
      ensureWatch(path);
      return { ok: true };
    },
  );

  app.get<{ Querystring: { since?: string; level?: string; limit?: string } }>(
    "/api/loom/logs",
    async () => ({ logs: [] }),
  );

  app.get("/api/loom/stage-url", async (_req, reply) => {
    try {
      const cur = requireCurrent();
      return { url: `http://127.0.0.1:${boundPort}/loom/preview/${cur.id}/`, projectId: cur.id };
    } catch (err: unknown) {
      reply.code(404);
      return { error: (err as Error).message };
    }
  });

  /**
   * Studio chrome — the page the user sees in their browser. Lazy-boots a Vite
   * dev server for the project, renders the wrapper HTML with viewport/theme/
   * route controls, and iframes the Vite-served preview.
   */
  app.get<{ Params: { projectId: string } }>(
    "/loom/preview/:projectId/",
    async (req, reply) => {
      const proj = projectList().find((p) => p.id === req.params.projectId);
      if (!proj) {
        reply.code(404);
        return reply.type("text/html").send(htmlError("Project not found", req.params.projectId));
      }
      ensureWatch(proj.path);
      try {
        const studio = await ensureStudio(proj);
        const routes = routeList(proj.path).map((r) => ({ path: r.path }));
        const html = renderStudioChrome({
          project: proj,
          vitePort: studio.port,
          daemonPort: boundPort,
          routes,
          daemonSecret: secret,
          featureProjectMgmt: config.featureProjectMgmt,
        });
        return reply.type("text/html").send(html);
      } catch (err: unknown) {
        reply.code(500);
        return reply.type("text/html").send(htmlError("Studio boot failed", (err as Error).message));
      }
    },
  );

  /** Redirect a trailing-slash-less variant to the canonical URL. */
  app.get<{ Params: { projectId: string } }>(
    "/loom/preview/:projectId",
    async (req, reply) => reply.redirect(`/loom/preview/${req.params.projectId}/`, 302),
  );

  /** Root path — show project picker or redirect to the only/current project. */
  app.get("/", async (_req, reply) => {
    const projects = projectList();
    const current = projectCurrent();
    if (current) {
      return reply.redirect(`/loom/preview/${current.id}/`, 302);
    }
    if (projects.length === 1) {
      return reply.redirect(`/loom/preview/${projects[0]!.id}/`, 302);
    }
    return reply.type("text/html").send(renderProjectIndex(projects));
  });

  // -- Terminal (claude session) -----------------------------------------
  //
  // Composes @celestial/forge.createClaudeRuntime + @celestial/lens.PtyScreenBuffer
  // server-side; @celestial/rift renders the resulting cell grids in the
  // browser via the bundle served from /__loom/vendor/terminal.js.

  app.get<{ Querystring: { projectId?: string } }>(
    "/api/loom/terminal/status",
    async (req, reply) => {
      const projectId = req.query.projectId ?? projectCurrent()?.id;
      if (!projectId) {
        reply.code(400);
        return { error: "projectId is required (or open a project first)" };
      }
      return await sessionStatusAsync(projectId);
    },
  );

  app.post<{ Body: { projectId?: string; flags?: string[] } }>(
    "/api/loom/terminal/start",
    async (req, reply) => {
      const projectId = req.body?.projectId ?? projectCurrent()?.id;
      const proj = projectList().find((p) => p.id === projectId);
      if (!proj) {
        reply.code(404);
        return { error: "project not found" };
      }
      const flags = Array.isArray(req.body?.flags)
        ? req.body.flags.filter((s): s is string => typeof s === "string")
        : [];
      try {
        await ensureClaudeSession(proj, { flags });
        return await sessionStatusAsync(proj.id);
      } catch (err: unknown) {
        reply.code(500);
        return { error: (err as Error).message };
      }
    },
  );

  app.post<{ Body: { projectId?: string } }>(
    "/api/loom/terminal/stop",
    async (req, _reply) => {
      const projectId = req.body?.projectId ?? projectCurrent()?.id;
      if (!projectId) return { stopped: false };
      await stopClaudeSession(projectId);
      return { stopped: true };
    },
  );

  app.post<{
    Body: {
      projectId?: string;
      path: string;
      viewport?: string;
      theme?: "light" | "dark";
      fullPage?: boolean;
    };
  }>("/api/loom/screenshot", async (req, reply) => {
    const projectId = req.body?.projectId ?? projectCurrent()?.id;
    const proj = projectList().find((p) => p.id === projectId);
    if (!proj) {
      reply.code(404);
      return { error: "project not found" };
    }
    if (!req.body?.path || typeof req.body.path !== "string") {
      reply.code(400);
      return { error: "path is required" };
    }
    try {
      const studio = await ensureStudio(proj);
      const result = await captureRouteScreenshot(proj, studio.url, {
        path: req.body.path,
        viewport: req.body.viewport,
        theme: req.body.theme,
        fullPage: req.body.fullPage,
      });
      if (!result.ok) {
        reply.code(503);
        return result;
      }
      if (config.featureProjectMgmt) {
        try {
          activityInsert({
            projectId: proj.id,
            kind: "session",
            subkind: "screenshot",
            title: `Captured ${req.body.path} @ ${result.viewport}/${result.theme}`,
            refPath: result.file,
          });
        } catch {
          /* never block on activity write */
        }
      }
      return result;
    } catch (err) {
      reply.code(500);
      return { error: (err as Error).message };
    }
  });

  app.register(async (instance) => {
    instance.get<{ Querystring: { projectId?: string } }>(
      "/api/loom/terminal/ws",
      { websocket: true },
      async (connection, req) => {
        const projectId = req.query.projectId ?? projectCurrent()?.id;
        const proj = projectList().find((p) => p.id === projectId);
        if (!proj) {
          try {
            connection.send(JSON.stringify({ kind: "error", message: "project not found" }));
            connection.close();
          } catch {
            /* noop */
          }
          return;
        }
        // Only ATTACH to an existing session. Spawning a new PTY here would
        // let stale browser tabs (reconnecting on close every few seconds)
        // resurrect claude processes for projects the user no longer cares
        // about — and a single bad spawn can wedge the daemon event loop.
        // PTY creation is gated to the modal-driven POST /terminal/start.
        const existing = getClaudeSession(proj.id);
        if (!existing) {
          try {
            connection.send(
              JSON.stringify({ kind: "error", message: "no active session — click Start session" }),
            );
            connection.close();
          } catch {
            /* noop */
          }
          return;
        }
        try {
          const session = await existing;
          attachMirror(session, {
            send: (data) => connection.send(data),
            on: (event, cb) => connection.on(event, cb as (...args: unknown[]) => void),
          });
        } catch (err: unknown) {
          try {
            connection.send(JSON.stringify({ kind: "error", message: (err as Error).message }));
            connection.close();
          } catch {
            /* noop */
          }
        }
      },
    );
  });

  // -- Project-management chrome (v0.10.0) -------------------------------
  // Gated by LOOM_FEATURE_PROJECT_MGMT=1 so partial deploys can't expose
  // half-built UI. All routes are thin wrappers around src/core/*.
  if (config.featureProjectMgmt) {
    function projectOr404(id: string | undefined, reply: import("fastify").FastifyReply) {
      const proj = id ? projectList().find((p) => p.id === id) : null;
      if (!proj) {
        reply.code(404);
        return null;
      }
      return proj;
    }

    app.get<{ Params: { id: string } }>(
      "/api/loom/projects/:id/git-status",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        return await gitStatus(proj.path);
      },
    );

    app.get<{ Params: { id: string } }>(
      "/api/loom/projects/:id/routes",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        const routes = routeList(proj.path).map((r) => ({
          path: r.path,
          file: r.file,
          meta: r.meta,
        }));
        return { routes };
      },
    );

    app.get<{ Params: { id: string } }>(
      "/api/loom/projects/:id/tokens",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        const loaded = loadTokens(proj.path);
        // Resolve each token individually so a bad ref in one file doesn't
        // collapse the entire response into a 500. The UI shows resolved=null
        // for broken tokens which is more useful than nothing.
        const tokens: Array<{
          namespace: string;
          name: string;
          raw: string;
          resolved: string | null;
          error?: string;
        }> = [];
        for (const [key, raw] of loaded.flat) {
          const [namespace, ...rest] = key.split(".");
          let resolved: string | null = null;
          let error: string | undefined;
          try {
            resolved = resolveValue(raw, loaded.flat, new Set([key]), [key]);
          } catch (err) {
            error = (err as Error).message;
          }
          tokens.push({
            namespace: namespace ?? "",
            name: rest.join("."),
            raw,
            resolved,
            ...(error ? { error } : {}),
          });
        }
        tokens.sort((a, b) => a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name));
        return { tokens };
      },
    );

    app.patch<{ Params: { id: string }; Body: { key?: string; value?: string } }>(
      "/api/loom/projects/:id/tokens",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        const key = req.body?.key;
        const value = req.body?.value;
        if (typeof key !== "string" || typeof value !== "string") {
          reply.code(400);
          return { error: "key and value are required strings" };
        }
        try {
          // setToken validates references + writes the namespace YAML atomically.
          // The existing chokidar watcher will pick up the change and emit
          // token_changed downstream, so no manual broadcast is needed here.
          setToken(proj.path, key, value);
          activityInsert({
            projectId: proj.id,
            kind: "token",
            subkind: "edit",
            title: `${key} → ${value.length > 40 ? value.slice(0, 37) + "…" : value}`,
            refPath: key,
          });
          return { ok: true, key, value };
        } catch (err) {
          reply.code(400);
          return { error: (err as Error).message };
        }
      },
    );

    app.get<{ Params: { id: string } }>(
      "/api/loom/projects/:id/components",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        return { components: componentList(proj.path) };
      },
    );

    app.get<{ Params: { id: string }; Querystring: { route?: string; limit?: string } }>(
      "/api/loom/projects/:id/versions",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        const limit = clampNumber(req.query.limit, 50, 1, 500);
        let versions = versionList(proj.path, limit);
        if (req.query.route) {
          const route = req.query.route;
          versions = versions.filter((v) => {
            const routeFile = route === "/" ? "routes/index.tsx" : `routes${route}.tsx`;
            return Object.keys(v.files).some((f) => f === routeFile || f.startsWith(`routes${route}/`));
          });
        }
        // Strip the big files map for the list endpoint — chrome only needs metadata.
        const slim = versions.map((v) => ({
          id: v.id,
          parentId: v.parentId,
          branch: v.branch,
          label: v.label,
          message: v.message,
          createdAt: v.createdAt,
          createdBy: v.createdBy,
          fileCount: Object.keys(v.files).length,
        }));
        return { versions: slim };
      },
    );

    app.get<{ Params: { id: string }; Querystring: { limit?: string; kind?: string } }>(
      "/api/loom/projects/:id/activity",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        const limit = clampNumber(req.query.limit, 50, 1, 500);
        const kinds = req.query.kind
          ? (req.query.kind.split(",").filter(Boolean) as ActivityKind[])
          : undefined;
        return { events: activityList(proj.id, { limit, ...(kinds ? { kinds } : {}) }) };
      },
    );

    app.post<{ Body: { name?: string; template?: "shadcn-starter" | "blank"; path?: string } }>(
      "/api/loom/projects",
      async (req, reply) => {
        const name = (req.body?.name ?? "").trim();
        if (!name) {
          reply.code(400);
          return { error: "name is required" };
        }
        try {
          const startedAt = Date.now();
          const created = await projectCreate({
            name,
            template: req.body?.template,
            ...(req.body?.path ? { path: req.body.path } : {}),
          });
          activityInsert({
            projectId: created.id,
            kind: "session",
            subkind: "created",
            title: `Project ${created.name} created`,
          });
          telemetry.emit({
            event: "project.create",
            template: req.body?.template ?? "shadcn-starter",
            duration_ms: Date.now() - startedAt,
          });
          return { project: created };
        } catch (err: unknown) {
          reply.code(400);
          return { error: (err as Error).message };
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/loom/projects/:id/open",
      async (req, reply) => {
        try {
          const startedAt = Date.now();
          const fromProject = projectCurrent();
          const opened = projectOpen(req.params.id);
          activityInsert({
            projectId: opened.id,
            kind: "session",
            subkind: "opened",
            title: `Project ${opened.name} opened`,
          });
          telemetry.emit({
            event: "project.switch",
            from_id: fromProject?.id ?? null,
            to_id: opened.id,
            duration_ms: Date.now() - startedAt,
          });
          return { project: opened };
        } catch (err: unknown) {
          reply.code(404);
          return { error: (err as Error).message };
        }
      },
    );

    app.get<{ Params: { id: string } }>(
      "/api/loom/projects/:id/canvas",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        return readCanvas(proj.path);
      },
    );

    app.put<{ Params: { id: string }; Body: CanvasState }>(
      "/api/loom/projects/:id/canvas",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        try {
          writeCanvas(proj.path, req.body);
          return { ok: true };
        } catch (err) {
          reply.code(400);
          return { error: (err as Error).message };
        }
      },
    );

    app.patch<{ Params: { id: string }; Body: { name?: string; description?: string } }>(
      "/api/loom/projects/:id",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        try {
          const updated = projectUpdate(proj.id, {
            ...(req.body?.name !== undefined ? { name: req.body.name } : {}),
            ...(req.body?.description !== undefined ? { description: req.body.description } : {}),
          });
          const what =
            req.body?.name !== undefined && req.body?.description !== undefined
              ? "updated"
              : req.body?.name !== undefined
                ? "renamed"
                : "description-updated";
          const detail =
            req.body?.name !== undefined ? `Renamed to ${updated.name}` : "Description updated";
          activityInsert({
            projectId: updated.id,
            kind: "session",
            subkind: what,
            title: detail,
          });
          return { project: updated };
        } catch (err: unknown) {
          reply.code(400);
          return { error: (err as Error).message };
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/loom/projects/:id/archive",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        try {
          activityInsert({
            projectId: proj.id,
            kind: "session",
            subkind: "archived",
            title: `Project ${proj.name} archived`,
          });
          projectArchive(proj.id);
          return { archived: true };
        } catch (err: unknown) {
          reply.code(400);
          return { error: (err as Error).message };
        }
      },
    );

    app.post<{ Params: { id: string; vid: string }; Querystring: { route?: string } }>(
      "/api/loom/projects/:id/versions/:vid/restore",
      async (req, reply) => {
        const proj = projectOr404(req.params.id, reply);
        if (!proj) return { error: "project not found" };
        try {
          const startedAt = Date.now();
          const result = versionRestoreWithAutoSnapshot(proj.path, "main", req.params.vid);
          activityInsert({
            projectId: proj.id,
            kind: "version",
            subkind: "restored",
            title: `Restored ${req.params.vid.slice(0, 10)} (prior state v${result.snapshotId.slice(0, 8)})`,
            refId: req.params.vid,
            payload: { priorSnapshotId: result.snapshotId, restoredCount: result.restored },
          });
          telemetry.emit({
            event: "version.restore",
            route: req.query?.route ?? null,
            version_id: req.params.vid,
            duration_ms: Date.now() - startedAt,
          });
          return { restored: true, priorSnapshotId: result.snapshotId, files: result.restored };
        } catch (err: unknown) {
          reply.code(400);
          return { error: (err as Error).message };
        }
      },
    );

    app.register(async (instance) => {
      instance.get<{ Params: { id: string } }>(
        "/api/loom/projects/:id/activity/stream",
        { websocket: true },
        (connection, req) => {
          const projectId = req.params.id;
          const proj = projectList().find((p) => p.id === projectId);
          if (!proj) {
            try {
              connection.send(JSON.stringify({ kind: "error", message: "project not found" }));
              connection.close();
            } catch {
              /* noop */
            }
            return;
          }
          const channel = `event:${projectId}`;
          const handler = (event: ActivityEvent): void => {
            try {
              connection.send(JSON.stringify({ kind: "event", event }));
            } catch {
              /* noop */
            }
          };
          activityBus.on(channel, handler);
          try {
            connection.send(JSON.stringify({ kind: "hello", projectId }));
          } catch {
            /* noop */
          }
          connection.on("close", () => activityBus.off(channel, handler));
        },
      );
    });
  }

  // Vendored browser bundle: rift + the loom terminal client.
  app.get<{ Params: { "*": string } }>(
    "/__loom/vendor/*",
    async (req, reply) => {
      const rel = req.params["*"] ?? "";
      if (!/^[a-zA-Z0-9._\-/]+$/.test(rel) || rel.includes("..")) {
        reply.code(400);
        return { error: "invalid path" };
      }
      const here = new URL("./", import.meta.url).pathname;
      // Windows: file URL path starts with /C:/...; strip the leading slash.
      const base = here.replace(/^\/([A-Za-z]:\/)/, "$1");
      const path = join(base, "vendor", rel);
      if (!existsSync(path)) {
        reply.code(404);
        return { error: "not found" };
      }
      const isCss = path.endsWith(".css");
      const isJs = path.endsWith(".js") || path.endsWith(".mjs");
      reply.type(isCss ? "text/css" : isJs ? "text/javascript" : "application/octet-stream");
      // No-cache while we iterate — the bundle changes on rebuild.
      reply.header("cache-control", "no-store");
      return reply.send(readFileSync(path));
    },
  );

  app.register(async (instance) => {
    instance.get("/api/loom/ws", { websocket: true }, (connection) => {
      const send = (data: string) => connection.send(data);
      const close = () => {
        try {
          connection.close();
        } catch {
          /* noop */
        }
      };
      const handle = { send, close };
      sockets.add(handle);
      send(
        JSON.stringify({
          kind: "hello",
          ts: Date.now(),
          version: pkgVersion(),
          project: projectCurrent(),
        }),
      );
      connection.on("close", () => sockets.delete(handle));
    });
  });

  const port = opts.port ?? DEFAULT_PORT;
  let boundPort = port;
  let attempt = 0;
  while (attempt < 10) {
    try {
      await app.listen({ host: "127.0.0.1", port: boundPort });
      break;
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "EADDRINUSE") {
        boundPort++;
        attempt++;
        continue;
      }
      throw err;
    }
  }

  writeRunFiles(boundPort);

  const url = `http://127.0.0.1:${boundPort}`;

  return {
    url,
    port: boundPort,
    stop: async () => {
      for (const h of watchers.values()) await h.close();
      watchers.clear();
      for (const s of sockets) {
        try {
          s.close();
        } catch {
          /* noop */
        }
      }
      sockets.clear();
      await stopAllClaudeSessions();
      await stopAllStudios();
      await app.close();
      clearRunFiles();
    },
  };
}

function htmlError(title: string, detail: string): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return `<!doctype html><html><head><title>loom — ${esc(title)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;padding:32px;max-width:640px;color:#111}
h1{margin:0 0 8px;font-size:18px}.detail{background:#f6f6f8;padding:12px;border-radius:6px;font-family:ui-monospace,monospace;font-size:12px}</style>
</head><body><h1>${esc(title)}</h1><div class="detail">${esc(detail)}</div></body></html>`;
}

function renderProjectIndex(projects: ReturnType<typeof projectList>): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const rows = projects
    .map(
      (p) =>
        `<li><a href="/loom/preview/${esc(p.id)}/"><strong>${esc(p.name)}</strong><span>${esc(p.path)}</span></a></li>`,
    )
    .join("");
  const empty = projects.length === 0 ? "<p>No projects yet. Run <code>/loom:new &lt;name&gt;</code>.</p>" : "";
  return `<!doctype html><html><head><title>loom</title>
<style>body{font:14px/1.5 system-ui,sans-serif;padding:32px;max-width:720px;color:#111}
h1{font-size:22px;margin:0 0 16px}ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}
li a{display:flex;flex-direction:column;gap:2px;padding:12px 14px;background:#f6f6f8;border-radius:8px;text-decoration:none;color:inherit}
li a:hover{background:#eee}li span{font-size:11.5px;color:#666;font-family:ui-monospace,monospace}</style>
</head><body><h1>loom · projects</h1>${empty}<ul>${rows}</ul></body></html>`;
}

function ensureSingleton(): void {
  mkdirSync(serverDir(), { recursive: true });
  const pidPath = serverPidPath();
  if (existsSync(pidPath)) {
    const pid = Number.parseInt(readFileSync(pidPath, "utf8"), 10);
    if (Number.isFinite(pid) && pid !== process.pid && isAlive(pid)) {
      throw new Error(
        `loom daemon already running as pid ${pid}; stop it via \`loom server stop\` or set LOOM_PORT to a different port`,
      );
    }
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function writeRunFiles(port: number): void {
  mkdirSync(serverDir(), { recursive: true });
  writeFileSync(serverPidPath(), String(process.pid));
  writeFileSync(serverPortPath(), String(port));
}

function clearRunFiles(): void {
  try {
    if (existsSync(serverPidPath())) unlinkSync(serverPidPath());
    if (existsSync(serverPortPath())) unlinkSync(serverPortPath());
  } catch {
    /* noop */
  }
}

function pkgVersion(): string {
  return process.env.LOOM_VERSION ?? "0.9.6";
}

function ensureDaemonSecret(): string {
  const path = join(serverDir(), "secret");
  if (existsSync(path)) {
    const value = readFileSync(path, "utf8").trim();
    if (value.length >= 32) return value;
  }
  const secret = randomBytes(32).toString("hex");
  mkdirSync(serverDir(), { recursive: true });
  writeFileSync(path, secret, { mode: 0o600 });
  return secret;
}

function classifyFileKind(path: string): ActivityKind {
  if (/[\\/]tokens[\\/]/.test(path)) return "token";
  if (/[\\/]components[\\/]/.test(path)) return "component";
  if (/[\\/]routes[\\/]/.test(path)) return "route";
  return "file";
}

function shortFilename(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function clampNumber(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function tokenEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

if (isMainModule(import.meta.url, process.argv[1])) {
  // Survive async crashes so a single bad PTY callback or stray rejection
  // doesn't take down the whole studio. Logged so the next repro leaves a
  // trace in the daemon log instead of a silent disappearance.
  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    process.stderr.write(`[loom-daemon] unhandledRejection: ${err.stack || err.message}\n`);
  });
  process.on("uncaughtException", (err) => {
    process.stderr.write(`[loom-daemon] uncaughtException: ${err.stack || err.message}\n`);
  });

  startDaemon().then((h) => {
    process.stderr.write(`loom daemon listening on ${h.url}\n`);
    const stop = async () => {
      await h.stop();
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  }).catch((err) => {
    process.stderr.write(`loom daemon failed: ${err.message}\n`);
    process.exit(1);
  });
}

/** Cross-platform `is-main-module` — Windows path separators + drive letters can
 *  defeat the naïve `import.meta.url === 'file://' + argv[1]` comparison. */
function isMainModule(metaUrl: string, argv1: string | undefined): boolean {
  if (!argv1) return false;
  try {
    const url = new URL(metaUrl);
    const argUrl = new URL(`file://${argv1.replace(/\\/g, "/")}`);
    return url.pathname.replace(/^\/+/, "").toLowerCase() ===
      argUrl.pathname.replace(/^\/+/, "").toLowerCase();
  } catch {
    return false;
  }
}
