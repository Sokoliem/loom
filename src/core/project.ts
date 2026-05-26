import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ulid } from "ulid";
import { randomBytes } from "node:crypto";
import YAML from "yaml";
import { execFileNoThrow } from "../utils/execFileNoThrow.js";
import { E } from "./errors.js";
import { migrateProject, migrateServer, openDb, type SqliteDB } from "./db.js";
import {
  assetsDir,
  componentsDir,
  defaultProjectRoot,
  exportsDir,
  forgeDir,
  loomCacheDir,
  mockDataDir,
  projectDbPath,
  projectManifestPath,
  projectSecretPath,
  routesDir,
  serverDbPath,
  snapshotsDir,
  tokensDir,
  validationDir,
} from "./paths.js";
import type { ProjectManifest, ProjectRecord } from "../types.js";

let _server: SqliteDB | null = null;
export function server(): SqliteDB {
  if (_server) return _server;
  _server = openDb(serverDbPath());
  migrateServer(_server);
  return _server;
}

/** Test-only: close the cached server connection so a temp DB file can be removed. */
export function _closeServerForTests(): void {
  if (_server) {
    try {
      _server.close();
    } catch {
      // already closed
    }
    _server = null;
  }
}

const ACTIVE_KEY = "active_project_id";

function readActive(): string | null {
  const row = server()
    .prepare(`SELECT value FROM server_state WHERE key = ?`)
    .get(ACTIVE_KEY) as { value: string } | undefined;
  return row?.value ?? null;
}

function writeActive(id: string | null): void {
  if (id === null) {
    server().prepare(`DELETE FROM server_state WHERE key = ?`).run(ACTIVE_KEY);
  } else {
    server()
      .prepare(
        `INSERT INTO server_state (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(ACTIVE_KEY, id);
  }
}

const _projectDbs = new Map<string, SqliteDB>();

export function projectDb(projectDir: string): SqliteDB {
  const cached = _projectDbs.get(projectDir);
  if (cached) return cached;
  const db = openDb(projectDbPath(projectDir));
  migrateProject(db);
  _projectDbs.set(projectDir, db);
  return db;
}

export interface CreateProjectInput {
  name: string;
  path?: string;
  template?: "shadcn-starter" | "blank";
}

export async function projectCreate(input: CreateProjectInput): Promise<ProjectRecord> {
  const name = input.name.trim();
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw E.invalid("project name", "use lowercase letters, digits, hyphens; start with a letter");
  }
  const existing = server().prepare(`SELECT id FROM projects WHERE name = ?`).get(name);
  if (existing) throw E.exists("project", name);

  const path = input.path ?? join(defaultProjectRoot(), name);
  if (existsSync(path)) {
    throw E.exists("project directory", path);
  }
  mkdirSync(path, { recursive: true });
  scaffoldProject(path, name, input.template ?? "shadcn-starter");
  await initGit(path);

  const id = ulid();
  const now = Date.now();
  server()
    .prepare(
      `INSERT INTO projects (id, name, path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, name, path, now, now);
  writeActive(id);

  // Initial version
  const db = projectDb(path);
  db.prepare(
    `INSERT INTO branches (name, head_version_id, created_at, protected) VALUES (?, ?, ?, ?)`,
  ).run("main", "init", now, 1);

  return {
    id,
    name,
    path,
    createdAt: now,
    lastOpenedAt: now,
    archived: false,
  };
}

export function projectOpen(nameOrId: string): ProjectRecord {
  const row = server()
    .prepare(`SELECT * FROM projects WHERE name = ? OR id = ?`)
    .get(nameOrId, nameOrId) as ProjectRow | undefined;
  if (!row) throw E.notFound("project", nameOrId);
  const now = Date.now();
  server().prepare(`UPDATE projects SET last_opened_at = ? WHERE id = ?`).run(now, row.id);
  writeActive(row.id);
  projectDb(row.path); // open + migrate
  return rowToRecord({ ...row, last_opened_at: now });
}

export function projectList(): ProjectRecord[] {
  const rows = server()
    .prepare(`SELECT * FROM projects ORDER BY last_opened_at DESC NULLS LAST`)
    .all() as ProjectRow[];
  return rows.map(rowToRecord);
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string;
}

/**
 * Update mutable project metadata. `name` is renamed in the projects table only
 * (the on-disk directory is not moved — that's a much larger operation). `description`
 * is persisted to the project's `loom.yaml` manifest, keeping the YAML as the
 * source of truth for content the user might commit to git.
 */
export function projectUpdate(id: string, input: ProjectUpdateInput): ProjectRecord {
  const row = server().prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as
    | ProjectRow
    | undefined;
  if (!row) throw E.notFound("project", id);

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      throw E.invalid("project name", "use lowercase letters, digits, hyphens; start with a letter");
    }
    if (name !== row.name) {
      const taken = server()
        .prepare(`SELECT id FROM projects WHERE name = ? AND id != ?`)
        .get(name, id);
      if (taken) throw E.exists("project", name);
      server().prepare(`UPDATE projects SET name = ? WHERE id = ?`).run(name, id);
      row.name = name;
    }
  }

  if (input.description !== undefined) {
    const manifestPath = projectManifestPath(row.path);
    let manifest: ProjectManifest;
    try {
      manifest = YAML.parse(readFileSync(manifestPath, "utf8")) as ProjectManifest;
    } catch {
      manifest = { name: row.name };
    }
    manifest.description = input.description;
    writeFileSync(manifestPath, YAML.stringify(manifest));
  }

  return rowToRecord(row);
}

export function projectArchive(id: string): void {
  const row = server().prepare(`SELECT id FROM projects WHERE id = ?`).get(id);
  if (!row) throw E.notFound("project", id);
  server().prepare(`UPDATE projects SET archived = 1 WHERE id = ?`).run(id);
  if (readActive() === id) writeActive(null);
}

export function projectCurrent(): ProjectRecord | null {
  const active = readActive();
  if (!active) return null;
  const row = server().prepare(`SELECT * FROM projects WHERE id = ?`).get(active) as
    | ProjectRow
    | undefined;
  return row ? rowToRecord(row) : null;
}

export function requireCurrent(): ProjectRecord {
  const cur = projectCurrent();
  if (!cur) throw E.noProject();
  return cur;
}

interface ProjectRow {
  id: string;
  name: string;
  path: string;
  created_at: number;
  last_opened_at: number | null;
  archived: number;
}

function rowToRecord(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    createdAt: row.created_at,
    lastOpenedAt: row.last_opened_at,
    archived: row.archived === 1,
  };
}

function scaffoldProject(path: string, name: string, template: string): void {
  mkdirSync(tokensDir(path), { recursive: true });
  mkdirSync(componentsDir(path), { recursive: true });
  mkdirSync(routesDir(path), { recursive: true });
  mkdirSync(mockDataDir(path), { recursive: true });
  mkdirSync(assetsDir(path), { recursive: true });
  mkdirSync(join(assetsDir(path), "images"), { recursive: true });
  mkdirSync(join(assetsDir(path), "fonts"), { recursive: true });
  mkdirSync(exportsDir(path), { recursive: true });
  mkdirSync(loomCacheDir(path), { recursive: true });
  mkdirSync(snapshotsDir(path), { recursive: true });
  mkdirSync(validationDir(path), { recursive: true });
  mkdirSync(forgeDir(path), { recursive: true });

  const manifest: ProjectManifest = {
    name,
    description: `${name} — loom project`,
    themes: ["light", "dark"],
    default_theme: "light",
    features: {
      hook_order_change_warning: true,
      deterministic_lint: true,
      auto_snapshots: true,
    },
  };
  writeFileSync(projectManifestPath(path), YAML.stringify(manifest));

  // Secret for review URL sharing.
  writeFileSync(projectSecretPath(path), randomBytes(32).toString("hex"));

  // .gitignore inside .loom
  writeFileSync(
    join(loomCacheDir(path), ".gitignore"),
    "snapshots/\nvalidation/\nforge/\n*.sqlite\n*.sqlite-*\nmanifest-hash\n",
  );
  writeFileSync(
    join(path, ".gitignore"),
    "node_modules/\nexports/\n.loom/snapshots/\n.loom/validation/\n.loom/forge/\n.loom/*.sqlite\n.loom/*.sqlite-*\n.loom/manifest-hash\n",
  );

  if (template === "shadcn-starter") {
    writeShadcnStarter(path);
  } else {
    writeBlankStarter(path);
  }
}

function writeShadcnStarter(path: string): void {
  // Seed tokens
  writeFileSync(
    join(tokensDir(path), "color.yaml"),
    YAML.stringify({
      seed: { hue: 250, chroma: 0.2 },
      accent: {
        primary: "oklch(0.65 {seed.chroma} {seed.hue})",
        muted: "oklch(0.85 0.05 {seed.hue})",
      },
      text: {
        primary: "oklch(0.20 0.02 {seed.hue})",
        muted: "oklch(0.45 0.02 {seed.hue})",
      },
      surface: {
        base: "oklch(0.98 0.01 {seed.hue})",
        card: "oklch(0.99 0.005 {seed.hue})",
      },
      border: { subtle: "oklch(0.92 0.01 {seed.hue})" },
    }),
  );
  writeFileSync(
    join(tokensDir(path), "typography.yaml"),
    YAML.stringify({
      family: {
        sans: "'Inter', system-ui, sans-serif",
        mono: "'JetBrains Mono', ui-monospace, monospace",
      },
      size: {
        xs: "12px",
        sm: "14px",
        base: "16px",
        lg: "18px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px",
      },
      weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
      leading: { tight: 1.15, normal: 1.5, relaxed: 1.7 },
    }),
  );
  writeFileSync(
    join(tokensDir(path), "spacing.yaml"),
    YAML.stringify({
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
      "16": "64px",
    }),
  );
  writeFileSync(
    join(tokensDir(path), "radius.yaml"),
    YAML.stringify({ none: "0px", sm: "4px", md: "8px", lg: "12px", xl: "16px", full: "9999px" }),
  );
  writeFileSync(
    join(tokensDir(path), "motion.yaml"),
    YAML.stringify({
      duration: { fast: "120ms", base: "200ms", slow: "320ms" },
      easing: { out: "cubic-bezier(0.16, 1, 0.3, 1)", inOut: "cubic-bezier(0.65, 0, 0.35, 1)" },
    }),
  );
  writeFileSync(
    join(tokensDir(path), "theme.yaml"),
    YAML.stringify({
      light: { background: "{surface.base}", foreground: "{text.primary}" },
      dark: {
        background: "oklch(0.18 0.02 {seed.hue})",
        foreground: "oklch(0.95 0.01 {seed.hue})",
      },
    }),
  );

  // Seed components
  mkdirSync(join(componentsDir(path), "Button"), { recursive: true });
  writeFileSync(
    join(componentsDir(path), "Button", "Button.tsx"),
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
`,
  );
  writeFileSync(
    join(componentsDir(path), "Button", "Button.spec.md"),
    `# Button\n\nPrimary call-to-action. Three variants: primary, secondary, ghost.\n`,
  );
  writeFileSync(
    join(componentsDir(path), "Button", "Button.tokens.yaml"),
    YAML.stringify({ uses: ["accent.primary", "surface.card", "text.primary", "border.subtle"] }),
  );
  writeFileSync(
    join(componentsDir(path), "Button", "Button.a11y.yaml"),
    YAML.stringify({
      requires: { contrast_ratio: 4.5, focus_visible: true, keyboard_activates: true },
    }),
  );
  writeFileSync(
    join(componentsDir(path), "Button", "Button.stories.mdx"),
    `import { Button } from "./Button";

# Button

<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
`,
  );

  // Seed routes
  writeFileSync(
    join(routesDir(path), "_layout.tsx"),
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
`,
  );
  writeFileSync(
    join(routesDir(path), "index.tsx"),
    `import { Button } from "../components/Button/Button";

export default function Home() {
  return (
    <main style={{ padding: "var(--spacing-8, 32px)" }}>
      <h1>Welcome to ${path.split(/[\\/]/).pop()}</h1>
      <p>Edit routes/index.tsx to get started.</p>
      <Button>Get started</Button>
    </main>
  );
}
`,
  );
}

function writeBlankStarter(path: string): void {
  writeFileSync(
    join(tokensDir(path), "color.yaml"),
    YAML.stringify({ accent: { primary: "oklch(0.65 0.2 250)" } }),
  );
  writeFileSync(
    join(routesDir(path), "index.tsx"),
    `export default function Home() { return <main>Hello</main>; }\n`,
  );
}

async function initGit(path: string): Promise<void> {
  const r1 = await execFileNoThrow("git", ["init", "-q"], path);
  if (r1.code !== 0) return;
  await execFileNoThrow("git", ["add", "-A"], path);
  await execFileNoThrow(
    "git",
    ["-c", "user.email=loom@local", "-c", "user.name=loom", "commit", "-q", "-m", "loom: init"],
    path,
  );
}
