#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/tsup/assets/esm_shims.js
import path from "path";
import { fileURLToPath } from "url";
var init_esm_shims = __esm({
  "node_modules/tsup/assets/esm_shims.js"() {
    "use strict";
  }
});

// src/utils/execFileNoThrow.ts
var execFileNoThrow_exports = {};
__export(execFileNoThrow_exports, {
  execFileNoThrow: () => execFileNoThrow
});
import { execFile } from "child_process";
function execFileNoThrow(cmd, args, cwd, env) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      {
        cwd,
        env: env ?? process.env,
        shell: false,
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024
      },
      (err, stdout, stderr) => {
        const code = err && typeof err.code === "number" ? err.code : err ? 1 : 0;
        resolve({
          code,
          stdout: stdout?.toString() ?? "",
          stderr: stderr?.toString() ?? ""
        });
      }
    );
  });
}
var init_execFileNoThrow = __esm({
  "src/utils/execFileNoThrow.ts"() {
    "use strict";
    init_esm_shims();
  }
});

// src/mcp/server.ts
init_esm_shims();
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from "@modelcontextprotocol/sdk/types.js";

// src/mcp/registry.ts
init_esm_shims();
import { z } from "zod";

// src/core/components.ts
init_esm_shims();
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { join as join2 } from "path";
import YAML from "yaml";

// src/core/errors.ts
init_esm_shims();
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
  cycle: (path2) => new LoomToolError(
    "E_TOKEN_CYCLE",
    `token reference cycle: ${path2.join(" \u2192 ")}`,
    "break the cycle by giving one node a literal value"
  ),
  forgePrecondition: (what) => new LoomToolError("E_FORGE_PRECONDITION", what, "commit or stash your working tree first")
};

// src/core/paths.ts
init_esm_shims();
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
function projectDbPath(projectDir) {
  return join(projectDir, ".loom", "project.sqlite");
}
function projectSecretPath(projectDir) {
  return join(projectDir, ".loom", "secret");
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
function exportsDir(projectDir) {
  return join(projectDir, "exports");
}
function loomCacheDir(projectDir) {
  return join(projectDir, ".loom");
}
function snapshotsDir(projectDir) {
  return join(loomCacheDir(projectDir), "snapshots");
}
function forgeDir(projectDir) {
  return join(loomCacheDir(projectDir), "forge");
}
function validationDir(projectDir) {
  return join(loomCacheDir(projectDir), "validation");
}
function defaultProjectRoot() {
  return process.env.LOOM_PROJECT_ROOT ?? join(homedir(), "loom");
}

// src/validate/hook-order.ts
init_esm_shims();

// src/validate/ast-utils.ts
init_esm_shims();
import * as babelParser from "@babel/parser";
function parseFile(source) {
  return babelParser.parse(source, {
    sourceType: "module",
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    errorRecovery: true,
    plugins: ["jsx", "typescript", "classProperties", "decorators-legacy", "topLevelAwait"]
  });
}
function walkAll(root, visitor) {
  const stack = [{ node: root, parent: null }];
  while (stack.length > 0) {
    const { node, parent } = stack.pop();
    const r = visitor(node, parent);
    if (r === false) continue;
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "start" || key === "end" || key === "type" || key === "raw") continue;
      const val = node[key];
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item && typeof item === "object" && typeof item.type === "string") {
              stack.push({ node: item, parent: node });
            }
          }
        } else if (typeof val.type === "string") {
          stack.push({ node: val, parent: node });
        }
      }
    }
  }
}

// src/validate/hook-order.ts
var REACT_HOOKS = /* @__PURE__ */ new Set([
  "useState",
  "useEffect",
  "useLayoutEffect",
  "useReducer",
  "useCallback",
  "useMemo",
  "useRef",
  "useContext",
  "useImperativeHandle",
  "useDeferredValue",
  "useTransition",
  "useId",
  "useSyncExternalStore",
  "useInsertionEffect",
  "useOptimistic",
  "useFormStatus",
  "useFormState",
  "useActionState"
]);
function extractHookSequence(source) {
  let ast;
  try {
    ast = parseFile(source);
  } catch {
    return [];
  }
  const entries = [];
  walkAll(ast, (n) => {
    if (n.type !== "CallExpression") return;
    const callee = n.callee;
    if (!callee) return;
    const pos = n.start ?? 0;
    if (callee.type === "Identifier" && REACT_HOOKS.has(callee.name)) {
      entries.push({ name: callee.name, pos });
    } else if (callee.type === "MemberExpression") {
      const prop = callee.property;
      if (prop?.type === "Identifier" && REACT_HOOKS.has(prop.name)) {
        entries.push({ name: prop.name, pos });
      }
    }
  });
  entries.sort((a, b) => a.pos - b.pos);
  return entries.map((e) => e.name);
}
function diffHookOrder(before, after) {
  const a = extractHookSequence(before);
  const b = extractHookSequence(after);
  if (a.length !== b.length) {
    return {
      rule: "hook-order-change",
      severity: "warn",
      message: `hook count changed (${a.length} \u2192 ${b.length}); this edit will lose component state on HMR`,
      details: { before: a, after: b }
    };
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return {
        rule: "hook-order-change",
        severity: "warn",
        message: `hook order changed at position ${i + 1} (${a[i]} \u2192 ${b[i]}); this edit will lose component state on HMR`,
        details: { before: a, after: b }
      };
    }
  }
  return null;
}

// src/core/components.ts
var NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
function componentCreate(projectDir, spec) {
  if (!NAME_RE.test(spec.name)) {
    throw E.invalid("component name", "PascalCase only");
  }
  const dir = join2(componentsDir(projectDir), spec.name);
  if (existsSync(dir)) throw E.exists("component", spec.name);
  mkdirSync(dir, { recursive: true });
  const jsx = spec.jsx ?? defaultJsx(spec);
  writeFileSync(join2(dir, `${spec.name}.tsx`), jsx);
  writeFileSync(
    join2(dir, `${spec.name}.spec.md`),
    `# ${spec.name}

${spec.description ?? "(describe purpose, variants, usage)"}
`
  );
  writeFileSync(
    join2(dir, `${spec.name}.tokens.yaml`),
    YAML.stringify({ uses: spec.uses_tokens ?? [] })
  );
  writeFileSync(
    join2(dir, `${spec.name}.a11y.yaml`),
    YAML.stringify({
      requires: { contrast_ratio: 4.5, focus_visible: true, keyboard_activates: true }
    })
  );
  writeFileSync(
    join2(dir, `${spec.name}.stories.mdx`),
    `import { ${spec.name} } from "./${spec.name}";

# ${spec.name}

<${spec.name} />
`
  );
  return componentGet(projectDir, spec.name);
}
function componentGet(projectDir, name) {
  const dir = join2(componentsDir(projectDir), name);
  if (!existsSync(dir)) throw E.notFound("component", name);
  return {
    name,
    hasComponent: existsSync(join2(dir, `${name}.tsx`)),
    hasSpec: existsSync(join2(dir, `${name}.spec.md`)),
    hasTokens: existsSync(join2(dir, `${name}.tokens.yaml`)),
    hasA11y: existsSync(join2(dir, `${name}.a11y.yaml`)),
    hasStories: existsSync(join2(dir, `${name}.stories.mdx`)),
    path: dir
  };
}
function componentList(projectDir, filter) {
  const dir = componentsDir(projectDir);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join2(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (!NAME_RE.test(entry)) continue;
    if (filter && !entry.toLowerCase().includes(filter.toLowerCase())) continue;
    out.push(componentGet(projectDir, entry));
  }
  return out;
}
function componentUpdate(projectDir, name, patch) {
  const rec = componentGet(projectDir, name);
  let warning;
  if (patch.jsx !== void 0) {
    const file = join2(rec.path, `${name}.tsx`);
    const before = readFileSync(file, "utf8");
    const detected = diffHookOrder(before, patch.jsx);
    if (detected && !patch.ack_state_loss) {
      throw Object.assign(
        new Error(`${detected.message}; re-call with { ack_state_loss: true } to proceed`),
        { code: "E_HOOK_ORDER_CHANGE", hint: JSON.stringify(detected.details) }
      );
    }
    warning = detected ?? void 0;
    writeFileSync(file, patch.jsx);
  }
  if (patch.description !== void 0) {
    writeFileSync(join2(rec.path, `${name}.spec.md`), `# ${name}

${patch.description}
`);
  }
  if (patch.uses_tokens !== void 0) {
    writeFileSync(
      join2(rec.path, `${name}.tokens.yaml`),
      YAML.stringify({ uses: patch.uses_tokens })
    );
  }
  return { ...componentGet(projectDir, name), hookOrderWarning: warning };
}
function componentDelete(projectDir, name) {
  const dir = join2(componentsDir(projectDir), name);
  if (!existsSync(dir)) throw E.notFound("component", name);
  rmSync(dir, { recursive: true, force: true });
}
function componentReadSource(projectDir, name) {
  const rec = componentGet(projectDir, name);
  return readFileSync(join2(rec.path, `${name}.tsx`), "utf8");
}
function defaultJsx(spec) {
  return `import { type ReactNode } from "react";

interface ${spec.name}Props {
  children?: ReactNode;
}

export function ${spec.name}({ children }: ${spec.name}Props) {
  return <div>{children}</div>;
}
`;
}

// src/core/project.ts
init_esm_shims();
init_execFileNoThrow();
import { existsSync as existsSync2, mkdirSync as mkdirSync3, writeFileSync as writeFileSync2 } from "fs";
import { join as join3 } from "path";
import { ulid } from "ulid";
import { randomBytes } from "crypto";
import YAML2 from "yaml";

// src/core/db.ts
init_esm_shims();
import Database from "better-sqlite3";
import { mkdirSync as mkdirSync2 } from "fs";
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
function openDb(path2) {
  mkdirSync2(dirname(path2), { recursive: true });
  const db = new Database(path2);
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
function writeActive(id) {
  if (id === null) {
    server().prepare(`DELETE FROM server_state WHERE key = ?`).run(ACTIVE_KEY);
  } else {
    server().prepare(
      `INSERT INTO server_state (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(ACTIVE_KEY, id);
  }
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
async function projectCreate(input) {
  const name = input.name.trim();
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw E.invalid("project name", "use lowercase letters, digits, hyphens; start with a letter");
  }
  const existing = server().prepare(`SELECT id FROM projects WHERE name = ?`).get(name);
  if (existing) throw E.exists("project", name);
  const path2 = input.path ?? join3(defaultProjectRoot(), name);
  if (existsSync2(path2)) {
    throw E.exists("project directory", path2);
  }
  mkdirSync3(path2, { recursive: true });
  scaffoldProject(path2, name, input.template ?? "shadcn-starter");
  await initGit(path2);
  const id = ulid();
  const now = Date.now();
  server().prepare(
    `INSERT INTO projects (id, name, path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, path2, now, now);
  writeActive(id);
  const db = projectDb(path2);
  db.prepare(
    `INSERT INTO branches (name, head_version_id, created_at, protected) VALUES (?, ?, ?, ?)`
  ).run("main", "init", now, 1);
  return {
    id,
    name,
    path: path2,
    createdAt: now,
    lastOpenedAt: now,
    archived: false
  };
}
function projectOpen(nameOrId) {
  const row = server().prepare(`SELECT * FROM projects WHERE name = ? OR id = ?`).get(nameOrId, nameOrId);
  if (!row) throw E.notFound("project", nameOrId);
  const now = Date.now();
  server().prepare(`UPDATE projects SET last_opened_at = ? WHERE id = ?`).run(now, row.id);
  writeActive(row.id);
  projectDb(row.path);
  return rowToRecord({ ...row, last_opened_at: now });
}
function projectList() {
  const rows = server().prepare(`SELECT * FROM projects ORDER BY last_opened_at DESC NULLS LAST`).all();
  return rows.map(rowToRecord);
}
function projectArchive(id) {
  const row = server().prepare(`SELECT id FROM projects WHERE id = ?`).get(id);
  if (!row) throw E.notFound("project", id);
  server().prepare(`UPDATE projects SET archived = 1 WHERE id = ?`).run(id);
  if (readActive() === id) writeActive(null);
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
function scaffoldProject(path2, name, template) {
  mkdirSync3(tokensDir(path2), { recursive: true });
  mkdirSync3(componentsDir(path2), { recursive: true });
  mkdirSync3(routesDir(path2), { recursive: true });
  mkdirSync3(mockDataDir(path2), { recursive: true });
  mkdirSync3(assetsDir(path2), { recursive: true });
  mkdirSync3(join3(assetsDir(path2), "images"), { recursive: true });
  mkdirSync3(join3(assetsDir(path2), "fonts"), { recursive: true });
  mkdirSync3(exportsDir(path2), { recursive: true });
  mkdirSync3(loomCacheDir(path2), { recursive: true });
  mkdirSync3(snapshotsDir(path2), { recursive: true });
  mkdirSync3(validationDir(path2), { recursive: true });
  mkdirSync3(forgeDir(path2), { recursive: true });
  const manifest = {
    name,
    description: `${name} \u2014 loom project`,
    themes: ["light", "dark"],
    default_theme: "light",
    features: {
      hook_order_change_warning: true,
      deterministic_lint: true,
      auto_snapshots: true
    }
  };
  writeFileSync2(projectManifestPath(path2), YAML2.stringify(manifest));
  writeFileSync2(projectSecretPath(path2), randomBytes(32).toString("hex"));
  writeFileSync2(
    join3(loomCacheDir(path2), ".gitignore"),
    "snapshots/\nvalidation/\nforge/\n*.sqlite\n*.sqlite-*\nmanifest-hash\n"
  );
  writeFileSync2(
    join3(path2, ".gitignore"),
    "node_modules/\nexports/\n.loom/snapshots/\n.loom/validation/\n.loom/forge/\n.loom/*.sqlite\n.loom/*.sqlite-*\n.loom/manifest-hash\n"
  );
  if (template === "shadcn-starter") {
    writeShadcnStarter(path2);
  } else {
    writeBlankStarter(path2);
  }
}
function writeShadcnStarter(path2) {
  writeFileSync2(
    join3(tokensDir(path2), "color.yaml"),
    YAML2.stringify({
      seed: { hue: 250, chroma: 0.2 },
      accent: {
        primary: "oklch(0.65 {seed.chroma} {seed.hue})",
        muted: "oklch(0.85 0.05 {seed.hue})"
      },
      text: {
        primary: "oklch(0.20 0.02 {seed.hue})",
        muted: "oklch(0.45 0.02 {seed.hue})"
      },
      surface: {
        base: "oklch(0.98 0.01 {seed.hue})",
        card: "oklch(0.99 0.005 {seed.hue})"
      },
      border: { subtle: "oklch(0.92 0.01 {seed.hue})" }
    })
  );
  writeFileSync2(
    join3(tokensDir(path2), "typography.yaml"),
    YAML2.stringify({
      family: {
        sans: "'Inter', system-ui, sans-serif",
        mono: "'JetBrains Mono', ui-monospace, monospace"
      },
      size: {
        xs: "12px",
        sm: "14px",
        base: "16px",
        lg: "18px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px"
      },
      weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
      leading: { tight: 1.15, normal: 1.5, relaxed: 1.7 }
    })
  );
  writeFileSync2(
    join3(tokensDir(path2), "spacing.yaml"),
    YAML2.stringify({
      "0": "0px",
      "1": "4px",
      "2": "8px",
      "3": "12px",
      "4": "16px",
      "5": "20px",
      "6": "24px",
      "8": "32px",
      "10": "40px",
      "12": "48px",
      "16": "64px"
    })
  );
  writeFileSync2(
    join3(tokensDir(path2), "radius.yaml"),
    YAML2.stringify({ none: "0px", sm: "4px", md: "8px", lg: "12px", xl: "16px", full: "9999px" })
  );
  writeFileSync2(
    join3(tokensDir(path2), "motion.yaml"),
    YAML2.stringify({
      duration: { fast: "120ms", base: "200ms", slow: "320ms" },
      easing: { out: "cubic-bezier(0.16, 1, 0.3, 1)", inOut: "cubic-bezier(0.65, 0, 0.35, 1)" }
    })
  );
  writeFileSync2(
    join3(tokensDir(path2), "theme.yaml"),
    YAML2.stringify({
      light: { background: "{surface.base}", foreground: "{text.primary}" },
      dark: {
        background: "oklch(0.18 0.02 {seed.hue})",
        foreground: "oklch(0.95 0.01 {seed.hue})"
      }
    })
  );
  mkdirSync3(join3(componentsDir(path2), "Button"), { recursive: true });
  writeFileSync2(
    join3(componentsDir(path2), "Button", "Button.tsx"),
    `import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
}

export function Button({ variant = "primary", className = "", children, ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors px-4 py-2";
  const variants: Record<string, string> = {
    primary: "bg-[var(--accent-primary)] text-white hover:opacity-90",
    secondary: "bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-subtle)]",
    ghost: "bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-card)]",
  };
  return (
    <button className={\`\${base} \${variants[variant]} \${className}\`} {...rest}>
      {children}
    </button>
  );
}
`
  );
  writeFileSync2(
    join3(componentsDir(path2), "Button", "Button.spec.md"),
    `# Button

Primary call-to-action. Three variants: primary, secondary, ghost.
`
  );
  writeFileSync2(
    join3(componentsDir(path2), "Button", "Button.tokens.yaml"),
    YAML2.stringify({ uses: ["accent.primary", "surface.card", "text.primary", "border.subtle"] })
  );
  writeFileSync2(
    join3(componentsDir(path2), "Button", "Button.a11y.yaml"),
    YAML2.stringify({
      requires: { contrast_ratio: 4.5, focus_visible: true, keyboard_activates: true }
    })
  );
  writeFileSync2(
    join3(componentsDir(path2), "Button", "Button.stories.mdx"),
    `import { Button } from "./Button";

# Button

<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
`
  );
  writeFileSync2(
    join3(routesDir(path2), "_layout.tsx"),
    `import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontFamily: "var(--font-family-sans, system-ui)",
      color: "var(--text-primary)",
      background: "var(--surface-base)",
      minHeight: "100vh",
    }}>
      {children}
    </div>
  );
}
`
  );
  writeFileSync2(
    join3(routesDir(path2), "index.tsx"),
    `import { Button } from "../components/Button/Button";

export default function Home() {
  return (
    <main style={{ padding: "var(--spacing-8, 32px)" }}>
      <h1>Welcome to ${path2.split(/[\\/]/).pop()}</h1>
      <p>Edit routes/index.tsx to get started.</p>
      <Button>Get started</Button>
    </main>
  );
}
`
  );
}
function writeBlankStarter(path2) {
  writeFileSync2(
    join3(tokensDir(path2), "color.yaml"),
    YAML2.stringify({ accent: { primary: "oklch(0.65 0.2 250)" } })
  );
  writeFileSync2(
    join3(routesDir(path2), "index.tsx"),
    `export default function Home() { return <main>Hello</main>; }
`
  );
}
async function initGit(path2) {
  const r1 = await execFileNoThrow("git", ["init", "-q"], path2);
  if (r1.code !== 0) return;
  await execFileNoThrow("git", ["add", "-A"], path2);
  await execFileNoThrow(
    "git",
    ["-c", "user.email=loom@local", "-c", "user.name=loom", "commit", "-q", "-m", "loom: init"],
    path2
  );
}

// src/core/routes.ts
init_esm_shims();
import {
  existsSync as existsSync3,
  mkdirSync as mkdirSync4,
  readFileSync as readFileSync3,
  readdirSync as readdirSync2,
  rmSync as rmSync2,
  statSync as statSync2,
  writeFileSync as writeFileSync3
} from "fs";
import { dirname as dirname2, join as join4, relative, sep } from "path";
var META_RE = /export\s+const\s+meta\s*=\s*({[\s\S]*?});/;
var PATH_RE = /^\/[a-z0-9-]*(\/[a-z0-9-]+)*$/;
function routeCreate(projectDir, path2, body, meta) {
  if (!PATH_RE.test(path2)) {
    throw E.invalid("route path", "lowercase, hyphen-separated, leading slash (e.g., /pricing)");
  }
  const file = routePathToFile(projectDir, path2);
  if (existsSync3(file)) throw E.exists("route", path2);
  mkdirSync4(dirname2(file), { recursive: true });
  writeFileSync3(file, composeRoute(body, meta));
  return { path: path2, file, meta: meta ?? {} };
}
function routeGet(projectDir, path2) {
  const file = routePathToFile(projectDir, path2);
  if (!existsSync3(file)) throw E.notFound("route", path2);
  return { path: path2, file, meta: extractMeta(readFileSync3(file, "utf8")) };
}
function routeList(projectDir) {
  const dir = routesDir(projectDir);
  if (!existsSync3(dir)) return [];
  const out = [];
  walk(dir, (file) => {
    if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) return;
    const rel = relative(dir, file).split(sep).join("/");
    if (rel.startsWith("_")) return;
    const path2 = filePathToRoute(rel);
    if (!path2) return;
    out.push({ path: path2, file, meta: extractMeta(readFileSync3(file, "utf8")) });
  });
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
function routeUpdate(projectDir, path2, patch) {
  const rec = routeGet(projectDir, path2);
  const current = readFileSync3(rec.file, "utf8");
  const newBody = patch.body ?? stripMeta(current);
  const newMeta = patch.meta ?? rec.meta;
  writeFileSync3(rec.file, composeRoute(newBody, newMeta));
  return { ...rec, meta: newMeta };
}
function routeDelete(projectDir, path2) {
  const file = routePathToFile(projectDir, path2);
  if (!existsSync3(file)) throw E.notFound("route", path2);
  rmSync2(file);
}
function routePathToFile(projectDir, path2) {
  const dir = routesDir(projectDir);
  if (path2 === "/") return join4(dir, "index.tsx");
  const parts = path2.replace(/^\//, "").split("/");
  const last = parts.pop();
  return join4(dir, ...parts, `${last}.tsx`);
}
function filePathToRoute(rel) {
  let p = rel.replace(/\.(tsx|jsx)$/, "");
  if (p === "index") return "/";
  if (p.endsWith("/index")) p = p.slice(0, -"/index".length);
  return `/${p}`;
}
function walk(dir, fn) {
  for (const entry of readdirSync2(dir)) {
    const full = join4(dir, entry);
    if (statSync2(full).isDirectory()) {
      walk(full, fn);
    } else {
      fn(full);
    }
  }
}
function composeRoute(body, meta) {
  const metaLine = meta && Object.keys(meta).length > 0 ? `export const meta = ${JSON.stringify(meta, null, 2)};

` : "";
  return `${metaLine}${body.trim()}
`;
}
function stripMeta(source) {
  return source.replace(META_RE, "").replace(/^\s+/, "");
}
function extractMeta(source) {
  const m = source.match(META_RE);
  if (!m) return {};
  try {
    return JSON.parse(m[1]);
  } catch {
    return {};
  }
}

// src/core/tokens.ts
init_esm_shims();
import { existsSync as existsSync4, mkdirSync as mkdirSync5, readFileSync as readFileSync4, readdirSync as readdirSync3, writeFileSync as writeFileSync4 } from "fs";
import { join as join5 } from "path";
import YAML3 from "yaml";
var REF_RE = /\{([a-zA-Z_][\w.]*)\}/g;
function loadTokens(projectDir) {
  const dir = tokensDir(projectDir);
  const trees = {};
  const flat = /* @__PURE__ */ new Map();
  if (!existsSync4(dir)) {
    return { trees, flat };
  }
  for (const file of readdirSync3(dir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    const namespace = file.replace(/\.ya?ml$/, "");
    const raw = readFileSync4(join5(dir, file), "utf8");
    const parsed = YAML3.parse(raw) ?? {};
    trees[namespace] = parsed;
    flattenInto(flat, parsed, namespace);
  }
  return { trees, flat };
}
function flattenInto(out, node, prefix) {
  if (node === null || node === void 0) return;
  if (typeof node !== "object") {
    out.set(prefix, String(node));
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    flattenInto(out, value, prefix ? `${prefix}.${key}` : key);
  }
}
function resolveValue(raw, flat, visiting = /* @__PURE__ */ new Set(), path2 = []) {
  return raw.replace(REF_RE, (_, ref) => {
    if (visiting.has(ref)) {
      throw E.cycle([...path2, ref]);
    }
    const target = flat.get(ref);
    if (target === void 0) {
      throw E.notFound("token", ref);
    }
    visiting.add(ref);
    try {
      return resolveValue(target, flat, visiting, [...path2, ref]);
    } finally {
      visiting.delete(ref);
    }
  });
}
function resolveAll(flat) {
  const out = /* @__PURE__ */ new Map();
  for (const [key, raw] of flat) {
    out.set(key, resolveValue(raw, flat, /* @__PURE__ */ new Set([key]), [key]));
  }
  return out;
}
function getToken(projectDir, ref) {
  const { flat } = loadTokens(projectDir);
  const raw = flat.get(ref);
  if (raw === void 0) throw E.notFound("token", ref);
  return resolveValue(raw, flat, /* @__PURE__ */ new Set([ref]), [ref]);
}
function listTokens(projectDir, namespace) {
  const { flat } = loadTokens(projectDir);
  const out = {};
  for (const [k, v] of flat) {
    if (namespace && !k.startsWith(`${namespace}.`)) continue;
    out[k] = v;
  }
  return out;
}
function setToken(projectDir, ref, value) {
  const segs = ref.split(".");
  if (segs.length < 2) {
    throw E.invalid("token reference", "use namespace.path form (e.g., color.accent.primary)");
  }
  const namespace = segs[0];
  const path2 = segs.slice(1);
  const dir = tokensDir(projectDir);
  mkdirSync5(dir, { recursive: true });
  const file = join5(dir, `${namespace}.yaml`);
  const tree = existsSync4(file) ? YAML3.parse(readFileSync4(file, "utf8")) ?? {} : {};
  setDeep(tree, path2, parseLiteral(value));
  const { flat } = loadTokens(projectDir);
  flat.set(ref, String(parseLiteral(value)));
  resolveAll(flat);
  writeFileSync4(file, YAML3.stringify(tree));
}
function setDeep(tree, path2, value) {
  let cur = tree;
  for (let i = 0; i < path2.length - 1; i++) {
    const key = path2[i];
    const next = cur[key];
    if (next === void 0 || typeof next !== "object" || next === null) {
      cur[key] = {};
    }
    cur = cur[key];
  }
  cur[path2[path2.length - 1]] = value;
}
function parseLiteral(value) {
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d*\.\d+$/.test(value)) return Number.parseFloat(value);
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

// src/core/version.ts
init_esm_shims();
import { mkdirSync as mkdirSync6, readFileSync as readFileSync5, readdirSync as readdirSync4, statSync as statSync3, writeFileSync as writeFileSync5 } from "fs";
import { dirname as dirname3, join as join6, relative as relative2, sep as sep2 } from "path";
import { ulid as ulid2 } from "ulid";

// src/core/hash.ts
init_esm_shims();
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

// src/core/version.ts
var TRACKED_DIRS = ["tokens", "components", "routes", "mock-data", "assets"];
var TRACKED_FILES = ["loom.yaml"];
var IGNORE_DIR_NAMES = /* @__PURE__ */ new Set([".loom", "node_modules", ".git", "exports", "dist"]);
function buildManifest(projectDir) {
  const files = [];
  for (const file of TRACKED_FILES) {
    const full = join6(projectDir, file);
    if (existsSafe(full)) {
      files.push(hashEntry(projectDir, full));
    }
  }
  for (const dir of TRACKED_DIRS) {
    const full = join6(projectDir, dir);
    if (existsSafe(full)) {
      walk2(full, (file) => files.push(hashEntry(projectDir, file)));
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const fileMap = {};
  for (const f of files) fileMap[f.path] = f.hash;
  const hash = sha256(canonicalize(fileMap));
  return { files, hash };
}
function existsSafe(path2) {
  try {
    statSync3(path2);
    return true;
  } catch {
    return false;
  }
}
function walk2(dir, fn) {
  for (const entry of readdirSync4(dir)) {
    if (IGNORE_DIR_NAMES.has(entry)) continue;
    const full = join6(dir, entry);
    const st = statSync3(full);
    if (st.isDirectory()) {
      walk2(full, fn);
    } else {
      fn(full);
    }
  }
}
function hashEntry(projectDir, file) {
  const content = readFileSync5(file);
  const relPath = relative2(projectDir, file).split(sep2).join("/");
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
        const buf = readFileSync5(join6(projectDir, f.path));
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
function versionRestore(projectDir, id, mode = "safe") {
  const db = projectDb(projectDir);
  const rec = versionGet(projectDir, id);
  if (mode === "force") {
    let count2 = 0;
    const txn = db.transaction(() => {
      for (const [relPath, hash] of Object.entries(rec.files)) {
        const blob = db.prepare(`SELECT content FROM file_blobs WHERE hash = ?`).get(hash);
        if (!blob) continue;
        const target = join6(projectDir, relPath);
        mkdirSync6(dirname3(target), { recursive: true });
        writeFileSync5(target, blob.content);
        count2++;
      }
    });
    txn();
    return { restored: count2, mode: "force" };
  }
  const stagingRoot = join6(projectDir, ".loom", "restore", id);
  let count = 0;
  for (const [relPath, hash] of Object.entries(rec.files)) {
    const blob = db.prepare(`SELECT content FROM file_blobs WHERE hash = ?`).get(hash);
    if (!blob) continue;
    const target = join6(stagingRoot, relPath);
    mkdirSync6(dirname3(target), { recursive: true });
    writeFileSync5(target, blob.content);
    count++;
  }
  return { restored: count, mode: "safe" };
}
function versionGet(projectDir, id) {
  const db = projectDb(projectDir);
  const row = db.prepare(`SELECT * FROM versions WHERE id = ?`).get(id);
  if (!row) throw E.notFound("version", id);
  return rowToVersion(row);
}
function versionList(projectDir, limit = 50) {
  const db = projectDb(projectDir);
  const rows = db.prepare(`SELECT * FROM versions ORDER BY created_at DESC LIMIT ?`).all(limit);
  return rows.map(rowToVersion);
}
function versionDiff(projectDir, from, to) {
  const a = versionGet(projectDir, from);
  const b = versionGet(projectDir, to);
  const aFiles = a.files;
  const bFiles = b.files;
  const added = [];
  const removed = [];
  const changed = [];
  const allPaths = /* @__PURE__ */ new Set([...Object.keys(aFiles), ...Object.keys(bFiles)]);
  for (const p of allPaths) {
    const ah = aFiles[p];
    const bh = bFiles[p];
    if (ah === void 0 && bh !== void 0) added.push(p);
    else if (ah !== void 0 && bh === void 0) removed.push(p);
    else if (ah !== bh) changed.push(p);
  }
  added.sort();
  removed.sort();
  changed.sort();
  return { from, to, added, removed, changed };
}
function branchList(projectDir) {
  const db = projectDb(projectDir);
  const rows = db.prepare(`SELECT * FROM branches ORDER BY name`).all();
  return rows.map((r) => ({
    name: r.name,
    headVersionId: r.head_version_id,
    createdAt: r.created_at,
    protected: r.protected === 1
  }));
}
function branchCreate(projectDir, name, fromBranch) {
  const db = projectDb(projectDir);
  const existing = db.prepare(`SELECT name FROM branches WHERE name = ?`).get(name);
  if (existing) throw E.exists("branch", name);
  const src = db.prepare(`SELECT head_version_id FROM branches WHERE name = ?`).get(fromBranch ?? "main");
  if (!src) throw E.notFound("branch", fromBranch ?? "main");
  const now = Date.now();
  db.prepare(
    `INSERT INTO branches (name, head_version_id, created_at, protected) VALUES (?, ?, ?, 0)`
  ).run(name, src.head_version_id, now);
  return {
    name,
    headVersionId: src.head_version_id,
    createdAt: now,
    protected: false
  };
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

// src/validate/index.ts
init_esm_shims();
import { ulid as ulid3 } from "ulid";

// src/validate/axe.ts
init_esm_shims();
async function runAxe(opts) {
  if (!opts.url && !opts.html) {
    return { available: false, reason: "no url or html provided", findings: [] };
  }
  let playwright = null;
  try {
    playwright = await import("playwright");
  } catch {
    return {
      available: false,
      reason: "playwright not installed \u2014 run `pnpm add playwright && pnpm exec playwright install chromium`",
      findings: []
    };
  }
  let axeSource = "";
  try {
    const axeModule = await import("axe-core");
    axeSource = axeModule.source ?? "";
  } catch {
    return {
      available: false,
      reason: "axe-core not installed \u2014 run `pnpm add axe-core`",
      findings: []
    };
  }
  if (!axeSource) {
    return { available: false, reason: "axe-core present but missing .source", findings: [] };
  }
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    if (opts.url) {
      await page.goto(opts.url, { waitUntil: "networkidle", timeout: 3e4 });
    } else if (opts.html) {
      await page.setContent(opts.html, { waitUntil: "networkidle", timeout: 3e4 });
    }
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async (tags) => {
      const w = globalThis;
      return w.axe.run({ runOnly: { type: "tag", values: tags } });
    }, opts.tags ?? ["wcag2a", "wcag2aa"]);
    const findings = [];
    for (const v of result.violations) {
      for (const n of v.nodes) {
        findings.push({
          rule: `axe:${v.id}`,
          severity: v.impact === "critical" || v.impact === "serious" ? "error" : "warn",
          file: opts.url ?? "(inline)",
          line: 0,
          column: 0,
          message: `${v.help} (impact: ${v.impact ?? "minor"})`,
          hint: n.failureSummary ?? v.helpUrl
        });
      }
    }
    return { available: true, findings };
  } finally {
    await browser.close();
  }
}

// src/validate/lints.ts
init_esm_shims();
import { existsSync as existsSync5, readFileSync as readFileSync6, readdirSync as readdirSync5, statSync as statSync4 } from "fs";
import { join as join7, relative as relative3, sep as sep3 } from "path";
var COLOR_LITERAL_RE = /(#[0-9a-fA-F]{3,8})|\b(rgb|rgba|hsl|hsla|oklch|oklab|color)\s*\(/;
var TOKEN_VAR_RE = /var\(\s*--[a-z][a-z0-9-]*/i;
var IGNORE_NEXT = /\/\/\s*loom-ignore-next-line/;
function tokenUsageLint(scope) {
  const tokens = loadTokens(scope.projectDir);
  const resolved = (() => {
    try {
      return resolveAll(tokens.flat);
    } catch {
      return /* @__PURE__ */ new Map();
    }
  })();
  const allowed = new Set(resolved.values());
  const findings = [];
  for (const file of collectSources(scope)) {
    const source = readFileSync6(file, "utf8");
    const ignored = ignoredLines(source);
    const rel = relative3(scope.projectDir, file).split(sep3).join("/");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (ignored.has(idx + 1)) return;
      if (TOKEN_VAR_RE.test(line)) return;
      const m = line.match(COLOR_LITERAL_RE);
      if (!m || m.index === void 0) return;
      const matched = m[0];
      if (allowed.has(matched.trim())) return;
      findings.push({
        rule: "token-usage",
        severity: "warn",
        file: rel,
        line: idx + 1,
        column: m.index + 1,
        message: `raw color literal '${matched}' is not defined as a token`,
        hint: "define it in tokens/color.yaml and reference via var(--\u2026) or {namespace.path}"
      });
    });
  }
  return findings;
}
function deterministicSourceLint(scope) {
  const findings = [];
  for (const file of collectSources(scope)) {
    const source = readFileSync6(file, "utf8");
    const rel = relative3(scope.projectDir, file).split(sep3).join("/");
    let ast;
    try {
      ast = parseFile(source);
    } catch {
      continue;
    }
    walkAll(ast, (node) => {
      if (node.type !== "CallExpression") return;
      const callee = node.callee;
      const flagged = nameOfCallee(callee);
      if (!flagged) return;
      const loc = node.loc?.start;
      if (!loc) return;
      findings.push({
        rule: "deterministic-source",
        severity: "warn",
        file: rel,
        line: loc.line,
        column: loc.column + 1,
        message: `non-deterministic source '${flagged}' used in component file`,
        hint: "pass a seedable equivalent through props or use a deterministic helper"
      });
    });
  }
  return findings;
}
function nameOfCallee(callee) {
  if (!callee) return null;
  if (callee.type === "MemberExpression") {
    const obj = callee.object;
    const prop = callee.property;
    const objName = obj?.type === "Identifier" ? obj.name : null;
    const propName = prop?.type === "Identifier" ? prop.name : null;
    if (objName === "Date" && propName === "now") return "Date.now";
    if (objName === "Math" && propName === "random") return "Math.random";
    if (objName === "crypto" && propName === "randomUUID") return "crypto.randomUUID";
    if (objName === "performance" && propName === "now") return "performance.now";
  }
  return null;
}
function ignoredLines(source) {
  const out = /* @__PURE__ */ new Set();
  source.split(/\r?\n/).forEach((line, idx) => {
    if (IGNORE_NEXT.test(line)) out.add(idx + 2);
  });
  return out;
}
function collectSources(scope) {
  if (scope.files) return scope.files;
  const files = [];
  const roots = [componentsDir(scope.projectDir), routesDir(scope.projectDir)];
  for (const root of roots) {
    if (!existsSync5(root)) continue;
    walk3(root, (file) => {
      if (file.endsWith(".tsx") || file.endsWith(".jsx") || file.endsWith(".ts")) {
        files.push(file);
      }
    });
  }
  return files;
}
function walk3(dir, fn) {
  for (const entry of readdirSync5(dir)) {
    const full = join7(dir, entry);
    if (statSync4(full).isDirectory()) {
      walk3(full, fn);
    } else {
      fn(full);
    }
  }
}

// src/validate/index.ts
async function runValidation(req) {
  const out = [];
  const versionId = buildManifest(req.projectDir).hash;
  for (const kind of req.kinds) {
    const result = await runOne(req, kind);
    out.push(result);
    persist(req.projectDir, versionId, req.scopeId ?? null, kind, result);
  }
  return out;
}
async function runOne(req, kind) {
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
      meta: { available: result.available, reason: result.reason }
    };
  }
  return { kind, findings: [], ts, meta: { error: "unknown kind" } };
}
function persist(projectDir, versionId, routePath, kind, result) {
  const db = projectDb(projectDir);
  db.prepare(
    `INSERT INTO validation_runs (id, version_id, route_path, kind, report_json, ts) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(ulid3(), versionId, routePath, kind, JSON.stringify(result), result.ts);
}

// src/export/index.ts
init_esm_shims();
import { mkdirSync as mkdirSync7, readFileSync as readFileSync7, writeFileSync as writeFileSync6 } from "fs";
import { join as join8 } from "path";
var EXPORTERS = {
  "css-vars": exportCssVars,
  tailwind: exportTailwind,
  "style-dictionary": exportStyleDictionary,
  "react-shadcn": exportReactShadcn,
  "storybook-mdx": exportStorybookMdx,
  "route-map-md": exportRouteMapMd,
  "static-bundle": exportStaticBundle
};
function runExport(projectDir, target, outDirAbs) {
  const exporter = EXPORTERS[target];
  if (!exporter) throw E.invalid("export target", `unknown target '${target}'`);
  const outDir = outDirAbs ?? join8(exportsDir(projectDir), target);
  mkdirSync7(outDir, { recursive: true });
  const files = exporter(projectDir, outDir);
  return { target, outDir, files };
}
function exportCssVars(projectDir, outDir) {
  const tokens = resolveAll(loadTokens(projectDir).flat);
  const lines = [":root {"];
  for (const [k, v] of [...tokens].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  --${k.replace(/\./g, "-")}: ${v};`);
  }
  lines.push("}");
  const file = join8(outDir, "tokens.css");
  writeFileSync6(file, lines.join("\n") + "\n");
  return [file];
}
function exportTailwind(projectDir, outDir) {
  const tokens = resolveAll(loadTokens(projectDir).flat);
  const config = {
    theme: { extend: { colors: {}, spacing: {}, fontSize: {}, borderRadius: {} } }
  };
  const theme = config.theme;
  for (const [k, v] of tokens) {
    if (k.startsWith("color.") || k.startsWith("accent.") || k.startsWith("surface.") || k.startsWith("text.") || k.startsWith("border.")) {
      theme.extend.colors[dotToCamel(k)] = v;
    } else if (k.startsWith("spacing.")) {
      theme.extend.spacing[k.slice("spacing.".length)] = v;
    } else if (k.startsWith("typography.size.")) {
      theme.extend.fontSize[k.slice("typography.size.".length)] = v;
    } else if (k.startsWith("radius.")) {
      theme.extend.borderRadius[k.slice("radius.".length)] = v;
    }
  }
  const file = join8(outDir, "tailwind.config.cjs");
  writeFileSync6(
    file,
    `/** Generated by loom. */
module.exports = ${JSON.stringify(config, null, 2)};
`
  );
  return [file];
}
function exportStyleDictionary(projectDir, outDir) {
  const { trees } = loadTokens(projectDir);
  const out = {};
  for (const [ns, tree] of Object.entries(trees)) {
    out[ns] = transformToSdShape(tree);
  }
  const file = join8(outDir, "tokens.json");
  writeFileSync6(file, JSON.stringify(out, null, 2));
  return [file];
}
function transformToSdShape(tree) {
  if (tree === null || typeof tree !== "object") {
    return { value: tree };
  }
  const obj = tree;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === "object") {
      out[k] = transformToSdShape(v);
    } else {
      out[k] = { value: v };
    }
  }
  return out;
}
function exportReactShadcn(projectDir, outDir) {
  const files = [];
  files.push(...exportCssVars(projectDir, outDir));
  files.push(...exportTailwind(projectDir, outDir));
  const pkg = {
    name: `${baseName(projectDir)}-export`,
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview"
    },
    dependencies: {
      react: "^18.3.0",
      "react-dom": "^18.3.0"
    },
    devDependencies: {
      vite: "^5.4.0",
      "@vitejs/plugin-react": "^4.3.0",
      typescript: "^5.7.0",
      tailwindcss: "^3.4.0",
      autoprefixer: "^10.4.0",
      postcss: "^8.4.0"
    }
  };
  const pkgFile = join8(outDir, "package.json");
  writeFileSync6(pkgFile, JSON.stringify(pkg, null, 2));
  files.push(pkgFile);
  writeFileSync6(
    join8(outDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM"],
          jsx: "react-jsx",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          allowImportingTsExtensions: true,
          noEmit: true
        },
        include: ["src", "components", "routes"]
      },
      null,
      2
    )
  );
  files.push(join8(outDir, "tsconfig.json"));
  writeFileSync6(
    join8(outDir, "vite.config.ts"),
    `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
`
  );
  files.push(join8(outDir, "vite.config.ts"));
  writeFileSync6(
    join8(outDir, "postcss.config.cjs"),
    `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
`
  );
  files.push(join8(outDir, "postcss.config.cjs"));
  mkdirSync7(join8(outDir, "components"), { recursive: true });
  mkdirSync7(join8(outDir, "routes"), { recursive: true });
  for (const c of componentList(projectDir)) {
    const sub = join8(outDir, "components", c.name);
    mkdirSync7(sub, { recursive: true });
    const src = componentReadSource(projectDir, c.name);
    writeFileSync6(join8(sub, `${c.name}.tsx`), src);
    files.push(join8(sub, `${c.name}.tsx`));
  }
  for (const r of routeList(projectDir)) {
    const dest = join8(outDir, "routes", `${routeToFileName(r.path)}.tsx`);
    mkdirSync7(join8(outDir, "routes"), { recursive: true });
    writeFileSync6(dest, readFileSync7(r.file, "utf8"));
    files.push(dest);
  }
  mkdirSync7(join8(outDir, "src"), { recursive: true });
  writeFileSync6(
    join8(outDir, "src", "main.tsx"),
    `import React from "react";
import ReactDOM from "react-dom/client";
import Home from "../routes/index";
import "../tokens.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><Home /></React.StrictMode>,
);
`
  );
  files.push(join8(outDir, "src", "main.tsx"));
  writeFileSync6(
    join8(outDir, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><title>${baseName(projectDir)}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
`
  );
  files.push(join8(outDir, "index.html"));
  const readme = join8(outDir, "README.md");
  writeFileSync6(
    readme,
    `# ${baseName(projectDir)} \u2014 React + shadcn export

Generated by loom.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`
`
  );
  files.push(readme);
  return files;
}
function exportStorybookMdx(projectDir, outDir) {
  const files = [];
  mkdirSync7(outDir, { recursive: true });
  for (const c of componentList(projectDir)) {
    const file = join8(outDir, `${c.name}.stories.mdx`);
    const src = readFileSync7(join8(c.path, `${c.name}.stories.mdx`), "utf8");
    writeFileSync6(file, src);
    files.push(file);
  }
  return files;
}
function exportRouteMapMd(projectDir, outDir) {
  const routes = routeList(projectDir);
  const lines = ["# Route map", ""];
  for (const r of routes) {
    lines.push(`- \`${r.path}\` \u2014 ${r.meta.title ?? "(untitled)"} (${r.meta.state ?? "draft"})`);
  }
  const file = join8(outDir, "routes.md");
  writeFileSync6(file, lines.join("\n") + "\n");
  return [file];
}
function exportStaticBundle(projectDir, outDir) {
  const tokens = resolveAll(loadTokens(projectDir).flat);
  const css = [":root {"];
  for (const [k, v] of [...tokens].sort(([a], [b]) => a.localeCompare(b))) {
    css.push(`  --${k.replace(/\./g, "-")}: ${v};`);
  }
  css.push("}");
  const routes = routeList(projectDir);
  const rendered = routes.map(
    (r) => `<section data-route="${r.path}"><h2>${r.meta.title ?? r.path}</h2><pre>${escape(
      readFileSync7(r.file, "utf8")
    )}</pre></section>`
  ).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${baseName(
    projectDir
  )}</title><style>${css.join("\n")}</style></head><body>${rendered}</body></html>
`;
  const file = join8(outDir, "bundle.html");
  writeFileSync6(file, html);
  return [file];
}
function dotToCamel(key) {
  return key.replace(/\.(.)/g, (_, c) => c.toUpperCase());
}
function escape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function routeToFileName(path2) {
  if (path2 === "/") return "index";
  return path2.replace(/^\//, "").replace(/\//g, "-");
}
function baseName(dir) {
  return dir.split(/[\\/]/).filter(Boolean).pop() ?? "project";
}

// src/panel/index.ts
init_esm_shims();
import { ulid as ulid4 } from "ulid";
var DEFAULT_AGENTS = [
  "visual-critic",
  "a11y-reviewer",
  "copy-editor",
  "brand-keeper",
  "responsive-checker"
];
function planPanelRun(input) {
  const runId = ulid4();
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
      focus: input.focus ?? null
    })
  };
}
function ingestPanelFindings(input) {
  const report = {
    ts: Date.now(),
    scope: input.scope,
    agents: dedupeAgents(input.findings.map((f) => f.agent)),
    findings: input.findings,
    missingAgents: input.missingAgents ?? [],
    costUsd: input.costUsd ?? 0,
    durationMs: input.durationMs ?? 0
  };
  const versionId = buildManifest(input.projectDir).hash;
  projectDb(input.projectDir).prepare(
    `INSERT INTO validation_runs (id, version_id, route_path, kind, report_json, ts) VALUES (?, ?, ?, 'panel', ?, ?)`
  ).run(input.runId, versionId, input.scope, JSON.stringify(report), report.ts);
  return report;
}
function recordPanelDecision(input) {
  const db = projectDb(input.projectDir);
  const row = db.prepare(`SELECT id, report_json FROM validation_runs WHERE kind = 'panel' ORDER BY ts DESC`).all();
  for (const r of row) {
    const report = JSON.parse(r.report_json);
    const idx = report.findings.findIndex((f) => f.id === input.findingId);
    if (idx === -1) continue;
    const updated = {
      ...report,
      findings: report.findings.map(
        (f, i) => i === idx ? {
          ...f,
          body: `${f.body}
[decision: ${input.action}${input.reason ? ` \u2014 ${input.reason}` : ""}]`
        } : f
      )
    };
    db.prepare(`UPDATE validation_runs SET report_json = ? WHERE id = ?`).run(
      JSON.stringify(updated),
      r.id
    );
    return;
  }
  throw Object.assign(new Error(`panel finding '${input.findingId}' not found`), {
    code: "E_FINDING_NOT_FOUND",
    hint: "list panel runs via the validation_runs table; the id is the finding id, not the run id"
  });
}
function renderDispatch(args) {
  const list = args.agents.map((a) => `   - ${a}`).join("\n");
  return `Panel run ${args.runId} is ready.

Scope: ${args.scope}
Agents: ${args.agents.length}
${list}
${args.focus ? `Focus: ${args.focus}
` : ""}
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
function dedupeAgents(list) {
  return Array.from(new Set(list));
}

// src/forge/index.ts
init_esm_shims();
init_execFileNoThrow();
import { mkdirSync as mkdirSync8, rmSync as rmSync3 } from "fs";
import { join as join9 } from "path";
import { ulid as ulid5 } from "ulid";
var DEFAULT_MAX_ITERS = 6;
var DEFAULT_MAX_COST = 0.5;
async function forgeStart(input) {
  await assertCleanWorkingTree(input.projectDir);
  const branch = await currentBranch(input.projectDir);
  const runId = ulid5();
  const worktreePath = join9(forgeDir(input.projectDir), runId);
  mkdirSync8(forgeDir(input.projectDir), { recursive: true });
  const worktreeBranch = `loom-forge/${runId}`;
  const r = await execFileNoThrow(
    "git",
    ["worktree", "add", "-b", worktreeBranch, worktreePath, branch],
    input.projectDir
  );
  if (r.code !== 0) {
    throw E.forgePrecondition(`failed to create worktree: ${r.stderr.trim()}`);
  }
  const maxIters = input.maxIters ?? DEFAULT_MAX_ITERS;
  const maxCostUsd = input.maxCostUsd ?? DEFAULT_MAX_COST;
  projectDb(input.projectDir).prepare(
    `INSERT INTO forge_runs (id, route_path, goal, iterations, final_confidence, cost_usd, outcome, worktree_path, squash_commit_sha, ts)
       VALUES (?, ?, ?, 0, 0, 0, 'running', ?, NULL, ?)`
  ).run(runId, input.routePath, input.goal, worktreePath, Date.now());
  const loopInstructions = renderLoopInstructions({
    runId,
    routePath: input.routePath,
    goal: input.goal,
    worktreePath,
    maxIters,
    maxCostUsd,
    branch,
    worktreeBranch
  });
  return {
    runId,
    worktreePath,
    branch,
    maxIters,
    maxCostUsd,
    goal: input.goal,
    routePath: input.routePath,
    loopInstructions
  };
}
async function forgeSquash(projectDir, runId) {
  const run = getRun(projectDir, runId);
  if (!run) throw E.notFound("forge_run", runId);
  if (run.outcome === "aborted") {
    return { sha: null, ok: false, stderr: "run was aborted" };
  }
  const branch = await currentBranch(projectDir);
  const r = await execFileNoThrow(
    "git",
    ["merge", "--squash", `loom-forge/${runId}`],
    projectDir
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
      `loom forge: ${run.goal} (run ${runId})`
    ],
    projectDir
  );
  if (c.code !== 0) {
    return { sha: null, ok: false, stderr: c.stderr };
  }
  const sha = (await execFileNoThrow("git", ["rev-parse", "HEAD"], projectDir)).stdout.trim();
  projectDb(projectDir).prepare(`UPDATE forge_runs SET outcome = 'converged', squash_commit_sha = ? WHERE id = ?`).run(sha, runId);
  const rm = await execFileNoThrow(
    "git",
    ["worktree", "remove", "--force", run.worktreePath],
    projectDir
  );
  const cleanupStderr = rm.code === 0 ? "" : rm.stderr;
  return { sha, ok: true, stderr: cleanupStderr };
}
async function forgeAbort(projectDir, runId) {
  const run = getRun(projectDir, runId);
  if (!run) throw E.notFound("forge_run", runId);
  const rm = await execFileNoThrow(
    "git",
    ["worktree", "remove", "--force", run.worktreePath],
    projectDir
  );
  if (rm.code !== 0) {
    try {
      rmSync3(run.worktreePath, { recursive: true, force: true });
    } catch (err) {
      throw new Error(
        `worktree cleanup failed: git stderr='${rm.stderr.trim()}'; fs error='${err.message}'`
      );
    }
  }
  projectDb(projectDir).prepare(`UPDATE forge_runs SET outcome = 'aborted' WHERE id = ?`).run(runId);
}
function recordForgeIteration(projectDir, runId, iter, confidence, costDelta) {
  projectDb(projectDir).prepare(
    `UPDATE forge_runs SET iterations = ?, final_confidence = ?, cost_usd = cost_usd + ? WHERE id = ?`
  ).run(iter, confidence, costDelta, runId);
}
function forgeRunList(projectDir, routePath) {
  const db = projectDb(projectDir);
  const rows = routePath ? db.prepare(`SELECT * FROM forge_runs WHERE route_path = ? ORDER BY ts DESC`).all(routePath) : db.prepare(`SELECT * FROM forge_runs ORDER BY ts DESC`).all();
  return rows.map(rowToRun);
}
function getRun(projectDir, runId) {
  const row = projectDb(projectDir).prepare(`SELECT * FROM forge_runs WHERE id = ?`).get(runId);
  return row ? rowToRun(row) : null;
}
function rowToRun(r) {
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
    ts: r.ts
  };
}
async function assertCleanWorkingTree(projectDir) {
  const r = await execFileNoThrow("git", ["status", "--porcelain"], projectDir);
  if (r.code !== 0) {
    throw E.forgePrecondition(`git unavailable or not a repo: ${r.stderr.trim()}`);
  }
  if (r.stdout.trim().length > 0) {
    throw E.forgePrecondition("working tree is not clean");
  }
}
async function currentBranch(projectDir) {
  const r = await execFileNoThrow("git", ["rev-parse", "--abbrev-ref", "HEAD"], projectDir);
  if (r.code !== 0) {
    throw E.forgePrecondition(`git rev-parse failed: ${r.stderr.trim()}`);
  }
  return r.stdout.trim() || "main";
}
function renderLoopInstructions(args) {
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

// src/reviews/index.ts
init_esm_shims();
import { ulid as ulid6 } from "ulid";
function reviewCreate(input) {
  const id = ulid6();
  const ts = Date.now();
  const msg = {
    id: ulid6(),
    author: input.author,
    body: input.body,
    severity: input.severity ?? null,
    agent: input.agent ?? null,
    screenshotHash: null,
    ts
  };
  const thread = {
    id,
    routePath: input.routePath,
    elementSelector: input.elementSelector,
    viewport: input.viewport,
    versionId: input.versionId,
    status: "open",
    source: input.source,
    createdAt: ts,
    resolvedAt: null,
    messages: [msg]
  };
  projectDb(input.projectDir).prepare(
    `INSERT INTO review_threads (id, route_path, element_selector, viewport, version_id, status, source, created_at, resolved_at, messages_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
  ).run(
    id,
    input.routePath,
    input.elementSelector,
    input.viewport,
    input.versionId,
    "open",
    input.source,
    ts,
    JSON.stringify([msg])
  );
  return thread;
}
function reviewList(projectDir, filters = {}) {
  const db = projectDb(projectDir);
  const clauses = [];
  const params = [];
  if (filters.routePath) {
    clauses.push("route_path = ?");
    params.push(filters.routePath);
  }
  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM review_threads ${where} ORDER BY created_at DESC`).all(...params);
  return rows.map(rowToThread);
}
function reviewGet(projectDir, id) {
  const row = projectDb(projectDir).prepare(`SELECT * FROM review_threads WHERE id = ?`).get(id);
  if (!row) throw E.notFound("review", id);
  return rowToThread(row);
}
function reviewResolve(projectDir, id, resolution) {
  const t = reviewGet(projectDir, id);
  const now = Date.now();
  projectDb(projectDir).prepare(`UPDATE review_threads SET status = ?, resolved_at = ? WHERE id = ?`).run(resolution, now, id);
  return { ...t, status: resolution, resolvedAt: now };
}
function rowToThread(r) {
  return {
    id: r.id,
    routePath: r.route_path,
    elementSelector: r.element_selector,
    viewport: r.viewport,
    versionId: r.version_id,
    status: r.status,
    source: r.source,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    messages: JSON.parse(r.messages_json)
  };
}

// src/doctor/index.ts
init_esm_shims();
init_execFileNoThrow();
async function runDoctor() {
  const checks = [];
  const nodeMajor = Number.parseInt(process.version.replace(/^v/, "").split(".")[0] ?? "0", 10);
  checks.push({
    name: "node-version",
    status: nodeMajor >= 22 ? "green" : "red",
    message: `node ${process.version} (need \u2265 22)`
  });
  const git = await execFileNoThrow("git", ["--version"]);
  checks.push({
    name: "git",
    status: git.code === 0 ? "green" : "red",
    message: git.code === 0 ? git.stdout.trim() : "git not found",
    hint: git.code === 0 ? void 0 : "install git from https://git-scm.com"
  });
  let playwrightStatus = "yellow";
  let playwrightMessage = "playwright not installed (optional; needed for axe + forge)";
  try {
    await import("playwright");
    playwrightStatus = "green";
    playwrightMessage = "playwright present";
  } catch {
  }
  checks.push({
    name: "playwright",
    status: playwrightStatus,
    message: playwrightMessage,
    hint: playwrightStatus === "yellow" ? "pnpm add -D playwright axe-core && pnpm exec playwright install chromium" : void 0
  });
  let axeStatus = "yellow";
  let axeMessage = "axe-core not installed (optional; needed for a11y validation)";
  try {
    await import("axe-core");
    axeStatus = "green";
    axeMessage = "axe-core present";
  } catch {
  }
  checks.push({ name: "axe-core", status: axeStatus, message: axeMessage });
  const cur = projectCurrent();
  checks.push({
    name: "current-project",
    status: cur ? "green" : "yellow",
    message: cur ? `${cur.name} (${cur.path})` : "no project open \u2014 run project_create or project_open"
  });
  const overall = aggregate(checks);
  return { overall, checks };
}
function aggregate(checks) {
  if (checks.some((c) => c.status === "red")) return "red";
  if (checks.some((c) => c.status === "yellow")) return "yellow";
  return "green";
}

// src/mcp/registry.ts
var ToolRegistry = class {
  tools = /* @__PURE__ */ new Map();
  add(name, description, schema, handler) {
    const inputSchema = zodToJsonSchema(schema);
    this.tools.set(name, {
      name,
      description,
      inputSchema,
      schema,
      handler: (args) => {
        const parsed = schema.parse(args ?? {});
        return handler(parsed);
      }
    });
  }
  get(name) {
    return this.tools.get(name);
  }
  list() {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }));
  }
};
function projectPath(name) {
  if (name) {
    const rec = projectOpen(name);
    return rec.path;
  }
  return requireCurrent().path;
}
function registerAllTools() {
  const r = new ToolRegistry();
  r.add(
    "project_create",
    "Create a new loom project with scaffolded tokens, components, routes, and git init",
    z.object({
      name: z.string(),
      path: z.string().optional(),
      template: z.enum(["shadcn-starter", "blank"]).optional()
    }),
    async (input) => projectCreate(input)
  );
  r.add(
    "project_open",
    "Open a project by name or id, making it the current project",
    z.object({ name: z.string() }),
    (input) => projectOpen(input.name)
  );
  r.add("project_list", "List all known projects", z.object({}), () => projectList());
  r.add(
    "project_archive",
    "Archive a project by id",
    z.object({ id: z.string() }),
    (input) => {
      projectArchive(input.id);
      return { ok: true };
    }
  );
  r.add(
    "project_current",
    "Return the currently open project, or null",
    z.object({}),
    () => projectCurrent()
  );
  r.add(
    "token_get",
    "Get a resolved token value",
    z.object({ ref: z.string(), theme: z.string().optional(), project: z.string().optional() }),
    (input) => ({ ref: input.ref, value: getToken(projectPath(input.project), input.ref) })
  );
  r.add(
    "token_set",
    "Set a token (creates the namespace YAML if missing). Re-validates cycle-freedom.",
    z.object({
      ref: z.string(),
      value: z.string(),
      theme: z.string().optional(),
      project: z.string().optional()
    }),
    (input) => {
      setToken(projectPath(input.project), input.ref, input.value);
      return { ok: true, ref: input.ref };
    }
  );
  r.add(
    "token_list",
    "List tokens, optionally filtered by namespace",
    z.object({ namespace: z.string().optional(), project: z.string().optional() }),
    (input) => listTokens(projectPath(input.project), input.namespace)
  );
  r.add(
    "token_resolve_all",
    "Resolve every token. Throws on cycles or missing refs.",
    z.object({ project: z.string().optional() }),
    (input) => Object.fromEntries(resolveAll(loadTokens(projectPath(input.project)).flat))
  );
  r.add(
    "component_create",
    "Create a component directory with .tsx, .spec.md, .tokens.yaml, .a11y.yaml, .stories.mdx",
    z.object({
      name: z.string(),
      description: z.string().optional(),
      uses_tokens: z.array(z.string()).optional(),
      jsx: z.string().optional(),
      project: z.string().optional()
    }),
    (input) => componentCreate(projectPath(input.project), {
      name: input.name,
      description: input.description,
      uses_tokens: input.uses_tokens,
      jsx: input.jsx
    })
  );
  r.add(
    "component_get",
    "Get a component record",
    z.object({ name: z.string(), project: z.string().optional() }),
    (input) => componentGet(projectPath(input.project), input.name)
  );
  r.add(
    "component_list",
    "List components, optionally filtered by substring",
    z.object({ filter: z.string().optional(), project: z.string().optional() }),
    (input) => componentList(projectPath(input.project), input.filter)
  );
  r.add(
    "component_update",
    "Update a component. Refuses (E_HOOK_ORDER_CHANGE) if a hook-order shift would cost component state on HMR \u2014 re-call with ack_state_loss=true to proceed.",
    z.object({
      name: z.string(),
      jsx: z.string().optional(),
      description: z.string().optional(),
      uses_tokens: z.array(z.string()).optional(),
      ack_state_loss: z.boolean().optional(),
      project: z.string().optional()
    }),
    (input) => componentUpdate(projectPath(input.project), input.name, {
      jsx: input.jsx,
      description: input.description,
      uses_tokens: input.uses_tokens,
      ack_state_loss: input.ack_state_loss
    })
  );
  r.add(
    "component_delete",
    "Delete a component",
    z.object({ name: z.string(), project: z.string().optional() }),
    (input) => {
      componentDelete(projectPath(input.project), input.name);
      return { ok: true };
    }
  );
  r.add(
    "component_snapshot",
    "Take a render snapshot of a component (requires Playwright; stub returns metadata only here)",
    z.object({
      name: z.string(),
      viewport: z.string().optional(),
      project: z.string().optional()
    }),
    (input) => ({
      ok: true,
      note: "snapshot rendering requires Playwright; ask the user to run `pnpm exec playwright install chromium`",
      component: input.name,
      viewport: input.viewport ?? "desktop"
    })
  );
  r.add(
    "component_promote",
    "Promote inline JSX into a component file",
    z.object({
      from_artifact: z.string(),
      name: z.string(),
      project: z.string().optional()
    }),
    (input) => componentCreate(projectPath(input.project), {
      name: input.name,
      jsx: input.from_artifact
    })
  );
  const routeMetaSchema = z.object({
    title: z.string().optional(),
    state: z.enum(["draft", "in-review", "approved"]).optional(),
    description: z.string().optional(),
    data: z.string().optional()
  });
  r.add(
    "route_create",
    "Create a route file. Path uses forward-slash form (e.g., / or /pricing).",
    z.object({
      path: z.string(),
      body: z.string(),
      meta: routeMetaSchema.optional(),
      project: z.string().optional()
    }),
    (input) => routeCreate(projectPath(input.project), input.path, input.body, input.meta)
  );
  r.add(
    "route_get",
    "Get a route record",
    z.object({ path: z.string(), project: z.string().optional() }),
    (input) => routeGet(projectPath(input.project), input.path)
  );
  r.add(
    "route_list",
    "List routes",
    z.object({ project: z.string().optional() }),
    (input) => routeList(projectPath(input.project))
  );
  r.add(
    "route_update",
    "Update a route's body or meta",
    z.object({
      path: z.string(),
      body: z.string().optional(),
      meta: routeMetaSchema.optional(),
      project: z.string().optional()
    }),
    (input) => routeUpdate(projectPath(input.project), input.path, {
      body: input.body,
      meta: input.meta
    })
  );
  r.add(
    "route_delete",
    "Delete a route",
    z.object({ path: z.string(), project: z.string().optional() }),
    (input) => {
      routeDelete(projectPath(input.project), input.path);
      return { ok: true };
    }
  );
  r.add(
    "route_screenshot",
    "Render a route at a viewport (requires Playwright; returns metadata stub if absent)",
    z.object({
      path: z.string(),
      viewport: z.string().optional(),
      theme: z.string().optional(),
      project: z.string().optional()
    }),
    (input) => ({
      ok: true,
      note: "screenshot requires Playwright + a running Vite preview; instruct the user to start a Vite dev server",
      path: input.path,
      viewport: input.viewport ?? "desktop",
      theme: input.theme ?? "light"
    })
  );
  r.add(
    "version_snapshot",
    "Create a new version snapshot of the project",
    z.object({
      branch: z.string().optional(),
      label: z.string().optional(),
      message: z.string().optional(),
      project: z.string().optional()
    }),
    (input) => versionSnapshot(projectPath(input.project), input.branch ?? "main", {
      label: input.label,
      message: input.message,
      createdBy: "user"
    })
  );
  r.add(
    "version_list",
    "List versions, newest first",
    z.object({ limit: z.number().int().min(1).max(500).optional(), project: z.string().optional() }),
    (input) => versionList(projectPath(input.project), input.limit ?? 50)
  );
  r.add(
    "version_diff",
    "Diff two versions",
    z.object({ from: z.string(), to: z.string(), project: z.string().optional() }),
    (input) => versionDiff(projectPath(input.project), input.from, input.to)
  );
  r.add(
    "version_get",
    "Get a version record",
    z.object({ id: z.string(), project: z.string().optional() }),
    (input) => versionGet(projectPath(input.project), input.id)
  );
  r.add(
    "version_restore",
    "Restore a prior version. 'safe' stages files under .loom/restore/<id>/ for review (no working-tree overwrite). 'force' overwrites the working tree from the version's blob store.",
    z.object({
      id: z.string(),
      mode: z.enum(["safe", "force"]).default("safe"),
      project: z.string().optional()
    }),
    (input) => versionRestore(projectPath(input.project), input.id, input.mode)
  );
  r.add(
    "branch_create",
    "Create a new branch from another",
    z.object({ name: z.string(), from: z.string().optional(), project: z.string().optional() }),
    (input) => branchCreate(projectPath(input.project), input.name, input.from)
  );
  r.add(
    "branch_list",
    "List all branches",
    z.object({ project: z.string().optional() }),
    (input) => branchList(projectPath(input.project))
  );
  r.add(
    "branch_switch",
    "Switch to a branch (via git checkout in the project working tree)",
    z.object({ name: z.string(), project: z.string().optional() }),
    async (input) => {
      const { execFileNoThrow: execFileNoThrow2 } = await Promise.resolve().then(() => (init_execFileNoThrow(), execFileNoThrow_exports));
      const r2 = await execFileNoThrow2("git", ["checkout", input.name], projectPath(input.project));
      return { ok: r2.code === 0, stderr: r2.stderr };
    }
  );
  r.add(
    "branch_merge",
    "Merge one branch into another via git merge. On conflict, returns the per-file list so the caller can drive resolution.",
    z.object({ from: z.string(), into: z.string(), project: z.string().optional() }),
    async (input) => {
      const { execFileNoThrow: execFileNoThrow2 } = await Promise.resolve().then(() => (init_execFileNoThrow(), execFileNoThrow_exports));
      const dir = projectPath(input.project);
      const co = await execFileNoThrow2("git", ["checkout", input.into], dir);
      if (co.code !== 0) return { ok: false, stderr: co.stderr, conflicts: [] };
      const m = await execFileNoThrow2("git", ["merge", "--no-ff", "--no-edit", input.from], dir);
      if (m.code === 0) return { ok: true, stderr: "", conflicts: [] };
      const status = await execFileNoThrow2(
        "git",
        ["diff", "--name-only", "--diff-filter=U"],
        dir
      );
      const conflicts = status.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      return {
        ok: false,
        stderr: m.stderr,
        conflicts,
        hint: conflicts.length > 0 ? "resolve each conflict file then run `git add <file>` and `git commit --no-edit`" : "merge failed without conflict markers; inspect git output"
      };
    }
  );
  r.add(
    "validate",
    "Run validations: axe, token-lint, ds-lint, deterministic-lint",
    z.object({
      scope: z.enum(["project", "route", "component"]).default("project"),
      scope_id: z.string().optional(),
      kinds: z.array(z.enum(["axe", "token-lint", "ds-lint", "deterministic-lint"])).default([
        "token-lint",
        "ds-lint",
        "deterministic-lint"
      ]),
      axe_url: z.string().optional(),
      project: z.string().optional()
    }),
    async (input) => runValidation({
      projectDir: projectPath(input.project),
      scope: input.scope,
      scopeId: input.scope_id,
      kinds: input.kinds,
      axe: input.axe_url ? { url: input.axe_url } : void 0
    })
  );
  r.add(
    "panel_run",
    "Plan a 5-agent panel run. Returns dispatch instructions for the calling Claude session to execute via Task tool in parallel.",
    z.object({
      scope: z.string(),
      agents: z.array(z.string()).optional(),
      focus: z.string().optional(),
      project: z.string().optional()
    }),
    (input) => planPanelRun({
      projectDir: projectPath(input.project),
      scope: input.scope,
      agents: input.agents,
      focus: input.focus
    })
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
          suggestedFix: z.string().nullable()
        })
      ),
      missingAgents: z.array(z.string()).optional(),
      costUsd: z.number().optional(),
      durationMs: z.number().optional(),
      project: z.string().optional()
    }),
    (input) => ingestPanelFindings({
      projectDir: projectPath(input.project),
      runId: input.runId,
      scope: input.scope,
      findings: input.findings,
      missingAgents: input.missingAgents,
      costUsd: input.costUsd,
      durationMs: input.durationMs
    })
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
        reason: input.reason
      });
      return { ok: true };
    }
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
        reason: input.reason
      });
      return { ok: true };
    }
  );
  r.add(
    "forge_run",
    "Plan a forge run: precondition-check working tree, create git worktree, return iteration instructions",
    z.object({
      route_path: z.string(),
      goal: z.string(),
      max_iters: z.number().int().min(1).max(20).optional(),
      max_cost_usd: z.number().positive().optional(),
      project: z.string().optional()
    }),
    async (input) => forgeStart({
      projectDir: projectPath(input.project),
      routePath: input.route_path,
      goal: input.goal,
      maxIters: input.max_iters,
      maxCostUsd: input.max_cost_usd
    })
  );
  r.add(
    "forge_iteration_record",
    "Record one forge iteration's outcome",
    z.object({
      runId: z.string(),
      iter: z.number().int().min(1),
      confidence: z.number().int().min(0).max(100),
      cost_delta: z.number().min(0).default(0),
      project: z.string().optional()
    }),
    (input) => {
      recordForgeIteration(
        projectPath(input.project),
        input.runId,
        input.iter,
        input.confidence,
        input.cost_delta
      );
      return { ok: true };
    }
  );
  r.add(
    "forge_squash",
    "Squash a converged forge worktree into the base branch as one commit",
    z.object({ runId: z.string(), project: z.string().optional() }),
    (input) => forgeSquash(projectPath(input.project), input.runId)
  );
  r.add(
    "forge_abort",
    "Abort a forge run, removing its worktree",
    z.object({ runId: z.string(), project: z.string().optional() }),
    async (input) => {
      await forgeAbort(projectPath(input.project), input.runId);
      return { ok: true };
    }
  );
  r.add(
    "forge_list",
    "List forge runs, optionally filtered by route_path",
    z.object({ route_path: z.string().optional(), project: z.string().optional() }),
    (input) => forgeRunList(projectPath(input.project), input.route_path)
  );
  r.add(
    "review_threads_list",
    "List review threads (optionally by route/status)",
    z.object({
      routePath: z.string().optional(),
      status: z.enum(["open", "resolved", "rejected"]).optional(),
      project: z.string().optional()
    }),
    (input) => reviewList(projectPath(input.project), {
      routePath: input.routePath,
      status: input.status
    })
  );
  r.add(
    "review_thread_get",
    "Get one review thread",
    z.object({ id: z.string(), project: z.string().optional() }),
    (input) => reviewGet(projectPath(input.project), input.id)
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
      project: z.string().optional()
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
        agent: input.agent
      });
    }
  );
  r.add(
    "review_thread_resolve",
    "Resolve or reject a review thread",
    z.object({
      id: z.string(),
      resolution: z.enum(["resolved", "rejected"]).default("resolved"),
      project: z.string().optional()
    }),
    (input) => reviewResolve(projectPath(input.project), input.id, input.resolution)
  );
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
        "static-bundle"
      ]),
      out_dir: z.string().optional(),
      project: z.string().optional()
    }),
    (input) => runExport(projectPath(input.project), input.target, input.out_dir)
  );
  r.add("server_status", "Daemon status snapshot (does not start the daemon)", z.object({}), () => ({
    ok: true,
    pid: process.pid,
    cwd: process.cwd(),
    project: projectCurrent()
  }));
  r.add(
    "stage_url",
    "Compute the stage URL for the current project + route + viewport (assumes daemon on LOOM_PORT or 5174)",
    z.object({
      routePath: z.string().optional(),
      viewport: z.string().optional(),
      theme: z.string().optional(),
      project: z.string().optional()
    }),
    (input) => {
      const cur = requireCurrent();
      const port = process.env.LOOM_PORT ?? "5174";
      const path2 = input.routePath ?? "/";
      return {
        url: `http://127.0.0.1:${port}/loom/preview/${cur.id}${path2}?viewport=${input.viewport ?? "desktop"}&theme=${input.theme ?? "light"}`,
        projectId: cur.id
      };
    }
  );
  r.add(
    "stage_open",
    "Return a clickable stage URL (the caller is responsible for opening it; environments differ)",
    z.object({ routePath: z.string().optional(), project: z.string().optional() }),
    (input) => {
      const cur = requireCurrent();
      const port = process.env.LOOM_PORT ?? "5174";
      return {
        url: `http://127.0.0.1:${port}/loom/preview/${cur.id}${input.routePath ?? "/"}`
      };
    }
  );
  r.add(
    "doctor",
    "Run loom doctor: Node version, git, Playwright, project health",
    z.object({}),
    () => runDoctor()
  );
  r.add(
    "logs",
    "Return recent telemetry events (placeholder \u2014 local SQLite ring buffer)",
    z.object({
      since: z.number().optional(),
      level: z.string().optional(),
      limit: z.number().int().min(1).max(1e3).optional()
    }),
    () => ({ events: [] })
  );
  return r;
}
function zodToJsonSchema(schema) {
  return zodNodeToSchema(schema);
}
function zodNodeToSchema(node) {
  const def = node._def;
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
        enum: def.values ?? def.entries
      };
    case "ZodArray":
      return {
        type: "array",
        items: zodNodeToSchema(def.type)
      };
    case "ZodObject": {
      const shape = node.shape;
      const properties = {};
      const required = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = zodNodeToSchema(v);
        if (!isOptional(v)) required.push(k);
      }
      return required.length > 0 ? { type: "object", properties, required } : { type: "object", properties };
    }
    case "ZodOptional":
      return zodNodeToSchema(def.innerType);
    case "ZodDefault":
      return zodNodeToSchema(def.innerType);
    case "ZodNullable":
      return zodNodeToSchema(def.innerType);
    case "ZodUnion":
      return {
        oneOf: def.options.map(zodNodeToSchema)
      };
    default:
      return {};
  }
}
function isOptional(node) {
  const def = node._def;
  return def.typeName === "ZodOptional" || def.typeName === "ZodDefault";
}

// src/mcp/server.ts
async function main() {
  const server2 = new Server(
    { name: "loom-tools", version: "0.9.0" },
    { capabilities: { tools: {} } }
  );
  const registry = registerAllTools();
  server2.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.list()
  }));
  server2.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = registry.get(req.params.name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `unknown tool: ${req.params.name}`);
    }
    try {
      const result = await tool.handler(req.params.arguments ?? {});
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (err) {
      const e = err;
      const message = e.message ?? String(err);
      const text = e.code && e.code.startsWith("E_") ? JSON.stringify({ ok: false, code: e.code, message, hint: e.hint }) : JSON.stringify({ ok: false, code: "E_INTERNAL", message });
      return { content: [{ type: "text", text }], isError: true };
    }
  });
  const transport = new StdioServerTransport();
  await server2.connect(transport);
  process.stderr.write("loom-tools MCP server ready on stdio\n");
}
main().catch((err) => {
  process.stderr.write(`loom-tools fatal: ${err.message}
`);
  process.exit(1);
});
//# sourceMappingURL=server.js.map