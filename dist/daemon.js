#!/usr/bin/env node

// src/daemon.ts
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { existsSync as existsSync3, mkdirSync as mkdirSync5, readFileSync as readFileSync4, unlinkSync, writeFileSync as writeFileSync4 } from "fs";
import { randomBytes as randomBytes2, timingSafeEqual } from "crypto";
import { join as join5 } from "path";

// src/core/paths.ts
import { homedir } from "os";
import { join } from "path";
function loomHome() {
  return process.env.LOOM_HOME ?? join(homedir(), ".loom");
}
function serverDir() {
  return join(loomHome(), "server");
}
function serverDbPath() {
  return join(serverDir(), "server.sqlite");
}
function serverPidPath() {
  return join(serverDir(), "pid");
}
function serverPortPath() {
  return join(serverDir(), "port");
}
function projectDbPath(projectDir) {
  return join(projectDir, ".loom", "project.sqlite");
}
function projectManifestPath(projectDir) {
  return join(projectDir, "loom.yaml");
}
function tokensDir(projectDir) {
  return join(projectDir, "tokens");
}
function componentsDir(projectDir) {
  return join(projectDir, "components");
}
function routesDir(projectDir) {
  return join(projectDir, "routes");
}
function mockDataDir(projectDir) {
  return join(projectDir, "mock-data");
}
function assetsDir(projectDir) {
  return join(projectDir, "assets");
}
function loomCacheDir(projectDir) {
  return join(projectDir, ".loom");
}

// src/core/watcher.ts
import chokidar from "chokidar";
import { existsSync as existsSync2, mkdirSync as mkdirSync4, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "fs";
import { join as join4 } from "path";

// src/core/version.ts
import { mkdirSync as mkdirSync3, readFileSync as readFileSync2, readdirSync, statSync, writeFileSync as writeFileSync2 } from "fs";
import { dirname as dirname2, join as join3, relative, sep } from "path";
import { ulid as ulid2 } from "ulid";

// src/core/hash.ts
import { createHash } from "crypto";
function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}
function canonicalize(value) {
  return JSON.stringify(sortValue(value));
}
function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const obj = value;
    const out = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortValue(obj[key]);
    }
    return out;
  }
  return value;
}

// src/core/errors.ts
var LoomToolError = class extends Error {
  code;
  hint;
  constructor(code, message, hint) {
    super(message);
    this.code = code;
    this.hint = hint;
  }
  toJSON() {
    return this.hint ? { code: this.code, message: this.message, hint: this.hint } : { code: this.code, message: this.message };
  }
};
var E = {
  noProject: () => new LoomToolError(
    "E_NO_PROJECT",
    "no project is open",
    "run project_open(name) or project_create(name) first"
  ),
  notFound: (kind, id) => new LoomToolError(`E_${kind.toUpperCase()}_NOT_FOUND`, `${kind} '${id}' not found`),
  exists: (kind, id) => new LoomToolError(`E_${kind.toUpperCase()}_EXISTS`, `${kind} '${id}' already exists`),
  invalid: (what, hint) => new LoomToolError("E_INVALID", `invalid ${what}`, hint),
  cycle: (path) => new LoomToolError(
    "E_TOKEN_CYCLE",
    `token reference cycle: ${path.join(" \u2192 ")}`,
    "break the cycle by giving one node a literal value"
  ),
  forgePrecondition: (what) => new LoomToolError("E_FORGE_PRECONDITION", what, "commit or stash your working tree first")
};

// src/core/project.ts
import { existsSync, mkdirSync as mkdirSync2, writeFileSync } from "fs";
import { join as join2 } from "path";
import { ulid } from "ulid";
import { randomBytes } from "crypto";
import YAML from "yaml";

// src/utils/execFileNoThrow.ts
import { execFile } from "child_process";

// src/core/db.ts
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
var SERVER_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_opened_at INTEGER,
    archived INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS server_state (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS telemetry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    project_id TEXT,
    payload_json TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry_events(ts)`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_events(event_type)`
];
var PROJECT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    branch TEXT NOT NULL,
    label TEXT,
    message TEXT,
    created_at INTEGER NOT NULL,
    created_by TEXT,
    files_json TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_versions_branch_ts ON versions(branch, created_at)`,
  `CREATE TABLE IF NOT EXISTS branches (
    name TEXT PRIMARY KEY,
    head_version_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    protected INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS file_blobs (
    hash TEXT PRIMARY KEY,
    size INTEGER NOT NULL,
    content BLOB NOT NULL,
    encoding TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS validation_runs (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL,
    route_path TEXT,
    kind TEXT NOT NULL,
    report_json TEXT NOT NULL,
    ts INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_validation_version_kind ON validation_runs(version_id, kind)`,
  `CREATE TABLE IF NOT EXISTS forge_runs (
    id TEXT PRIMARY KEY,
    route_path TEXT NOT NULL,
    goal TEXT NOT NULL,
    iterations INTEGER NOT NULL,
    final_confidence INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    outcome TEXT NOT NULL,
    worktree_path TEXT NOT NULL,
    squash_commit_sha TEXT,
    ts INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_forge_route_ts ON forge_runs(route_path, ts)`,
  `CREATE TABLE IF NOT EXISTS token_cache (
    version_id TEXT NOT NULL,
    reference TEXT NOT NULL,
    theme TEXT NOT NULL,
    resolved_value TEXT NOT NULL,
    PRIMARY KEY (version_id, reference, theme)
  )`,
  `CREATE TABLE IF NOT EXISTS review_threads (
    id TEXT PRIMARY KEY,
    route_path TEXT NOT NULL,
    element_selector TEXT NOT NULL,
    viewport TEXT NOT NULL,
    version_id TEXT NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER,
    messages_json TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_review_route_status ON review_threads(route_path, status)`,
  `CREATE TABLE IF NOT EXISTS route_states (
    route_path TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    approver TEXT,
    updated_at INTEGER NOT NULL
  )`
];
function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  return db;
}
function runAll(db, statements) {
  for (const stmt of statements) {
    db.prepare(stmt).run();
  }
}
function migrateServer(db) {
  runAll(db, SERVER_SCHEMA);
}
function migrateProject(db) {
  runAll(db, PROJECT_SCHEMA);
}

// src/core/project.ts
var _server = null;
function server() {
  if (_server) return _server;
  _server = openDb(serverDbPath());
  migrateServer(_server);
  return _server;
}
var ACTIVE_KEY = "active_project_id";
function readActive() {
  const row = server().prepare(`SELECT value FROM server_state WHERE key = ?`).get(ACTIVE_KEY);
  return row?.value ?? null;
}
var _projectDbs = /* @__PURE__ */ new Map();
function projectDb(projectDir) {
  const cached = _projectDbs.get(projectDir);
  if (cached) return cached;
  const db = openDb(projectDbPath(projectDir));
  migrateProject(db);
  _projectDbs.set(projectDir, db);
  return db;
}
function projectList() {
  const rows = server().prepare(`SELECT * FROM projects ORDER BY last_opened_at DESC NULLS LAST`).all();
  return rows.map(rowToRecord);
}
function projectCurrent() {
  const active = readActive();
  if (!active) return null;
  const row = server().prepare(`SELECT * FROM projects WHERE id = ?`).get(active);
  return row ? rowToRecord(row) : null;
}
function requireCurrent() {
  const cur = projectCurrent();
  if (!cur) throw E.noProject();
  return cur;
}
function rowToRecord(row) {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    createdAt: row.created_at,
    lastOpenedAt: row.last_opened_at,
    archived: row.archived === 1
  };
}

// src/core/version.ts
var TRACKED_DIRS = ["tokens", "components", "routes", "mock-data", "assets"];
var TRACKED_FILES = ["loom.yaml"];
var IGNORE_DIR_NAMES = /* @__PURE__ */ new Set([".loom", "node_modules", ".git", "exports", "dist"]);
function buildManifest(projectDir) {
  const files = [];
  for (const file of TRACKED_FILES) {
    const full = join3(projectDir, file);
    if (existsSafe(full)) {
      files.push(hashEntry(projectDir, full));
    }
  }
  for (const dir of TRACKED_DIRS) {
    const full = join3(projectDir, dir);
    if (existsSafe(full)) {
      walk(full, (file) => files.push(hashEntry(projectDir, file)));
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const fileMap = {};
  for (const f of files) fileMap[f.path] = f.hash;
  const hash = sha256(canonicalize(fileMap));
  return { files, hash };
}
function existsSafe(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
function walk(dir, fn) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIR_NAMES.has(entry)) continue;
    const full = join3(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, fn);
    } else {
      fn(full);
    }
  }
}
function hashEntry(projectDir, file) {
  const content = readFileSync2(file);
  const relPath = relative(projectDir, file).split(sep).join("/");
  return { path: relPath, hash: sha256(content), size: content.length };
}
function versionSnapshot(projectDir, branch, input = {}) {
  const db = projectDb(projectDir);
  const manifest = buildManifest(projectDir);
  const versionId = manifest.hash;
  const existing = db.prepare(`SELECT id FROM versions WHERE id = ?`).get(versionId);
  const now = Date.now();
  if (!existing) {
    const parent = db.prepare(`SELECT head_version_id FROM branches WHERE name = ?`).get(branch);
    const filesMap = {};
    for (const f of manifest.files) filesMap[f.path] = f.hash;
    const upsertBlob = db.prepare(
      `INSERT OR IGNORE INTO file_blobs (hash, size, content, encoding) VALUES (?, ?, ?, ?)`
    );
    const txn = db.transaction(() => {
      for (const f of manifest.files) {
        const buf = readFileSync2(join3(projectDir, f.path));
        const encoding = isProbablyBinary(buf) ? "binary" : "utf-8";
        upsertBlob.run(f.hash, f.size, buf, encoding);
      }
      db.prepare(
        `INSERT INTO versions (id, parent_id, branch, label, message, created_at, created_by, files_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        versionId,
        parent?.head_version_id && parent.head_version_id !== "init" ? parent.head_version_id : null,
        branch,
        input.label ?? null,
        input.message ?? null,
        now,
        input.createdBy ?? "user",
        JSON.stringify(filesMap)
      );
      db.prepare(
        `INSERT INTO branches (name, head_version_id, created_at, protected)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(name) DO UPDATE SET head_version_id = excluded.head_version_id`
      ).run(branch, versionId, now);
    });
    txn();
  }
  return versionGet(projectDir, versionId);
}
function isProbablyBinary(buf) {
  const sample = buf.subarray(0, Math.min(512, buf.length));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}
function versionGet(projectDir, id) {
  const db = projectDb(projectDir);
  const row = db.prepare(`SELECT * FROM versions WHERE id = ?`).get(id);
  if (!row) throw E.notFound("version", id);
  return rowToVersion(row);
}
function rowToVersion(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    branch: row.branch,
    label: row.label,
    message: row.message,
    createdAt: row.created_at,
    createdBy: row.created_by,
    files: JSON.parse(row.files_json)
  };
}

// src/core/watcher.ts
function startWatcher(projectDir, listener) {
  const targets = [
    projectManifestPath(projectDir),
    tokensDir(projectDir),
    componentsDir(projectDir),
    routesDir(projectDir),
    mockDataDir(projectDir),
    assetsDir(projectDir)
  ].filter(existsSync2);
  let lastManifestHash = readManifestHash(projectDir);
  const watcher = chokidar.watch(targets, {
    ignoreInitial: true,
    ignored: (path) => path.includes(".loom") || path.includes("node_modules"),
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 }
  });
  let debounce = null;
  const flush = () => {
    debounce = null;
    const manifest = buildManifest(projectDir);
    if (manifest.hash !== lastManifestHash) {
      const from = lastManifestHash;
      lastManifestHash = manifest.hash;
      writeManifestHash(projectDir, manifest.hash);
      listener({ kind: "manifest_changed", from, to: manifest.hash });
    }
  };
  const routesRoot = routesDir(projectDir);
  const componentsRoot = componentsDir(projectDir);
  const onEvent = (file) => {
    const isRouteFile = file.startsWith(routesRoot) && (file.endsWith(".tsx") || file.endsWith(".jsx"));
    const isComponentFile = file.startsWith(componentsRoot) && (file.endsWith(".tsx") || file.endsWith(".jsx"));
    if (isRouteFile || isComponentFile) {
      listener({ kind: "route_changed", path: file });
    }
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(flush, 100);
  };
  watcher.on("add", onEvent).on("change", onEvent).on("unlink", onEvent);
  return {
    close: async () => {
      if (debounce) clearTimeout(debounce);
      await watcher.close();
    }
  };
}
function manifestHashPath(projectDir) {
  return join4(loomCacheDir(projectDir), "manifest-hash");
}
function readManifestHash(projectDir) {
  try {
    const f = manifestHashPath(projectDir);
    if (!existsSync2(f)) return null;
    return readFileSync3(f, "utf8").trim();
  } catch {
    return null;
  }
}
function writeManifestHash(projectDir, hash) {
  const dir = loomCacheDir(projectDir);
  mkdirSync4(dir, { recursive: true });
  writeFileSync3(manifestHashPath(projectDir), hash);
}

// src/daemon.ts
var DEFAULT_PORT = Number(process.env.LOOM_PORT ?? 5174);
async function startDaemon(opts = {}) {
  ensureSingleton();
  const secret = ensureDaemonSecret();
  const app = Fastify({ logger: false });
  await app.register(websocket);
  app.addHook("preHandler", async (req, reply) => {
    if (req.method === "GET" && req.url.startsWith("/api/loom/healthz")) return;
    if (req.url.startsWith("/api/loom/ws")) return;
    const origin = req.headers.origin;
    if (origin && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      reply.code(403);
      return reply.send({ error: "cross-origin denied" });
    }
    if (req.method !== "GET") {
      const provided = req.headers["x-loom-secret"] ?? "";
      if (!tokenEquals(provided, secret)) {
        reply.code(401);
        return reply.send({ error: "missing or invalid X-Loom-Secret" });
      }
    }
  });
  const watchers = /* @__PURE__ */ new Map();
  const sockets = /* @__PURE__ */ new Set();
  function broadcast(event) {
    const payload = JSON.stringify({ ts: Date.now(), ...event });
    for (const s of sockets) {
      try {
        s.send(payload);
      } catch {
      }
    }
  }
  function ensureWatch(projectDir) {
    if (watchers.has(projectDir)) return;
    const handle = startWatcher(projectDir, (ev) => {
      if (ev.kind === "manifest_changed") {
        try {
          const v = versionSnapshot(projectDir, "main", { createdBy: "auto" });
          broadcast({ kind: "version_snapshot", projectDir, versionId: v.id });
        } catch {
        }
      }
      broadcast({ projectDir, ...ev });
    });
    watchers.set(projectDir, handle);
  }
  app.get("/api/loom/healthz", async () => ({
    status: "ok",
    ts: Date.now(),
    version: pkgVersion()
  }));
  app.get("/api/loom/projects", async () => ({ projects: projectList() }));
  app.get("/api/loom/current", async () => ({ project: projectCurrent() }));
  app.get(
    "/api/loom/manifest",
    async (req, reply) => {
      const cur = projectCurrent();
      if (!cur) {
        reply.code(404);
        return { error: "no project open" };
      }
      ensureWatch(cur.path);
      return buildManifest(cur.path);
    }
  );
  app.post(
    "/api/loom/watch",
    async (req, reply) => {
      const path = req.body?.path;
      if (!path || !existsSync3(path)) {
        reply.code(400);
        return { error: "path is required and must exist" };
      }
      const known = new Set(projectList().map((p) => p.path));
      if (!known.has(path)) {
        reply.code(403);
        return { error: "path is not a registered project" };
      }
      ensureWatch(path);
      return { ok: true };
    }
  );
  app.get(
    "/api/loom/logs",
    async () => ({ logs: [] })
  );
  app.get("/api/loom/stage-url", async (_req, reply) => {
    try {
      const cur = requireCurrent();
      return { url: `http://127.0.0.1:${boundPort}/loom/preview/${cur.id}/`, projectId: cur.id };
    } catch (err) {
      reply.code(404);
      return { error: err.message };
    }
  });
  app.register(async (instance) => {
    instance.get("/api/loom/ws", { websocket: true }, (connection) => {
      const send = (data) => connection.send(data);
      const close = () => {
        try {
          connection.close();
        } catch {
        }
      };
      const handle = { send, close };
      sockets.add(handle);
      send(
        JSON.stringify({
          kind: "hello",
          ts: Date.now(),
          version: pkgVersion(),
          project: projectCurrent()
        })
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
    } catch (err) {
      if (err.code === "EADDRINUSE") {
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
        }
      }
      sockets.clear();
      await app.close();
      clearRunFiles();
    }
  };
}
function ensureSingleton() {
  mkdirSync5(serverDir(), { recursive: true });
  const pidPath = serverPidPath();
  if (existsSync3(pidPath)) {
    const pid = Number.parseInt(readFileSync4(pidPath, "utf8"), 10);
    if (Number.isFinite(pid) && pid !== process.pid && isAlive(pid)) {
      throw new Error(
        `loom daemon already running as pid ${pid}; stop it via \`loom server stop\` or set LOOM_PORT to a different port`
      );
    }
  }
}
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function writeRunFiles(port) {
  mkdirSync5(serverDir(), { recursive: true });
  writeFileSync4(serverPidPath(), String(process.pid));
  writeFileSync4(serverPortPath(), String(port));
}
function clearRunFiles() {
  try {
    if (existsSync3(serverPidPath())) unlinkSync(serverPidPath());
    if (existsSync3(serverPortPath())) unlinkSync(serverPortPath());
  } catch {
  }
}
function pkgVersion() {
  return process.env.LOOM_VERSION ?? "0.9.0";
}
function ensureDaemonSecret() {
  const path = join5(serverDir(), "secret");
  if (existsSync3(path)) {
    const value = readFileSync4(path, "utf8").trim();
    if (value.length >= 32) return value;
  }
  const secret = randomBytes2(32).toString("hex");
  mkdirSync5(serverDir(), { recursive: true });
  writeFileSync4(path, secret, { mode: 384 });
  return secret;
}
function tokenEquals(a, b) {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  startDaemon().then((h) => {
    process.stderr.write(`loom daemon listening on ${h.url}
`);
    const stop = async () => {
      await h.stop();
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  }).catch((err) => {
    process.stderr.write(`loom daemon failed: ${err.message}
`);
    process.exit(1);
  });
}
export {
  startDaemon
};
//# sourceMappingURL=daemon.js.map