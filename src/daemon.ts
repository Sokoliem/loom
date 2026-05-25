import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { serverDir, serverPidPath, serverPortPath } from "./core/paths.js";
import { startWatcher, type WatchEvent, type WatcherHandle } from "./core/watcher.js";
import { projectCurrent, projectList, requireCurrent } from "./core/project.js";
import { buildManifest, versionSnapshot } from "./core/version.js";

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

  function ensureWatch(projectDir: string): void {
    if (watchers.has(projectDir)) return;
    const handle = startWatcher(projectDir, (ev) => {
      if (ev.kind === "manifest_changed") {
        try {
          const v = versionSnapshot(projectDir, "main", { createdBy: "auto" });
          broadcast({ kind: "version_snapshot", projectDir, versionId: v.id });
        } catch {
          // ignore — partial states during edit storms
        }
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
      await app.close();
      clearRunFiles();
    },
  };
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
  return process.env.LOOM_VERSION ?? "0.9.0";
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

function tokenEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
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
