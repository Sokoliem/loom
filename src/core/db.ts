import Database, { type Database as DB } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SqliteDB = DB;

const SERVER_SCHEMA = [
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
  `CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_events(event_type)`,
  `CREATE TABLE IF NOT EXISTS activity_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    subkind TEXT,
    title TEXT NOT NULL,
    ref_path TEXT,
    ref_id TEXT,
    payload TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_activity_project_created
    ON activity_events(project_id, created_at DESC)`,
];

const PROJECT_SCHEMA = [
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
  )`,
];

export function openDb(path: string): SqliteDB {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  return db;
}

function runAll(db: SqliteDB, statements: readonly string[]): void {
  for (const stmt of statements) {
    db.prepare(stmt).run();
  }
}

export function migrateServer(db: SqliteDB): void {
  runAll(db, SERVER_SCHEMA);
}

export function migrateProject(db: SqliteDB): void {
  runAll(db, PROJECT_SCHEMA);
}
