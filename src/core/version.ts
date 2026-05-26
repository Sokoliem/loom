import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { ulid } from "ulid";
import { canonicalize, sha256 } from "./hash.js";
import { E } from "./errors.js";
import { projectDb } from "./project.js";
import type { BranchRecord, VersionRecord } from "../types.js";

const TRACKED_DIRS = ["tokens", "components", "routes", "mock-data", "assets"];
const TRACKED_FILES = ["loom.yaml"];
const IGNORE_DIR_NAMES = new Set([".loom", "node_modules", ".git", "exports", "dist"]);

export interface ManifestEntry {
  path: string;
  hash: string;
  size: number;
}

export interface Manifest {
  files: ManifestEntry[];
  hash: string;
}

export function buildManifest(projectDir: string): Manifest {
  const files: ManifestEntry[] = [];
  for (const file of TRACKED_FILES) {
    const full = join(projectDir, file);
    if (existsSafe(full)) {
      files.push(hashEntry(projectDir, full));
    }
  }
  for (const dir of TRACKED_DIRS) {
    const full = join(projectDir, dir);
    if (existsSafe(full)) {
      walk(full, (file) => files.push(hashEntry(projectDir, file)));
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const fileMap: Record<string, string> = {};
  for (const f of files) fileMap[f.path] = f.hash;
  const hash = sha256(canonicalize(fileMap));
  return { files, hash };
}

function existsSafe(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function walk(dir: string, fn: (file: string) => void): void {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, fn);
    } else {
      fn(full);
    }
  }
}

function hashEntry(projectDir: string, file: string): ManifestEntry {
  const content = readFileSync(file);
  const relPath = relative(projectDir, file).split(sep).join("/");
  return { path: relPath, hash: sha256(content), size: content.length };
}

export interface SnapshotInput {
  label?: string;
  message?: string;
  createdBy?: VersionRecord["createdBy"];
}

export function versionSnapshot(
  projectDir: string,
  branch: string,
  input: SnapshotInput = {},
): VersionRecord {
  const db = projectDb(projectDir);
  const manifest = buildManifest(projectDir);
  const versionId = manifest.hash;
  const existing = db.prepare(`SELECT id FROM versions WHERE id = ?`).get(versionId);
  const now = Date.now();
  if (!existing) {
    const parent = db
      .prepare(`SELECT head_version_id FROM branches WHERE name = ?`)
      .get(branch) as { head_version_id: string } | undefined;
    const filesMap: Record<string, string> = {};
    for (const f of manifest.files) filesMap[f.path] = f.hash;

    // Persist file blobs so version_restore can materialize prior states.
    const upsertBlob = db.prepare(
      `INSERT OR IGNORE INTO file_blobs (hash, size, content, encoding) VALUES (?, ?, ?, ?)`,
    );
    const txn = db.transaction(() => {
      for (const f of manifest.files) {
        const buf = readFileSync(join(projectDir, f.path));
        const encoding = isProbablyBinary(buf) ? "binary" : "utf-8";
        upsertBlob.run(f.hash, f.size, buf, encoding);
      }
      db.prepare(
        `INSERT INTO versions (id, parent_id, branch, label, message, created_at, created_by, files_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        versionId,
        parent?.head_version_id && parent.head_version_id !== "init"
          ? parent.head_version_id
          : null,
        branch,
        input.label ?? null,
        input.message ?? null,
        now,
        input.createdBy ?? "user",
        JSON.stringify(filesMap),
      );
      db.prepare(
        `INSERT INTO branches (name, head_version_id, created_at, protected)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(name) DO UPDATE SET head_version_id = excluded.head_version_id`,
      ).run(branch, versionId, now);
    });
    txn();
  }
  return versionGet(projectDir, versionId);
}

function isProbablyBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(512, buf.length));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

export function versionRestore(
  projectDir: string,
  id: string,
  mode: "safe" | "force" = "safe",
): { restored: number; mode: "safe" | "force" } {
  const db = projectDb(projectDir);
  const rec = versionGet(projectDir, id);
  if (mode === "force") {
    let count = 0;
    const txn = db.transaction(() => {
      for (const [relPath, hash] of Object.entries(rec.files)) {
        const blob = db.prepare(`SELECT content FROM file_blobs WHERE hash = ?`).get(hash) as
          | { content: Buffer }
          | undefined;
        if (!blob) continue;
        const target = join(projectDir, relPath);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, blob.content);
        count++;
      }
    });
    txn();
    return { restored: count, mode: "force" };
  }
  // safe mode: stage into .loom/restore/<id>/ rather than overwriting working tree
  const stagingRoot = join(projectDir, ".loom", "restore", id);
  let count = 0;
  for (const [relPath, hash] of Object.entries(rec.files)) {
    const blob = db.prepare(`SELECT content FROM file_blobs WHERE hash = ?`).get(hash) as
      | { content: Buffer }
      | undefined;
    if (!blob) continue;
    const target = join(stagingRoot, relPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, blob.content);
    count++;
  }
  return { restored: count, mode: "safe" };
}

/**
 * Restore a version after first snapshotting the working tree to a new version.
 * This is the safe-by-default path for the studio's "restore" button: the user's
 * current state is preserved as a fresh version (createdBy="user", label="auto-snapshot
 * before restore"), then the requested version's files are written into the working
 * tree. Returns both the snapshot id and the restore result so callers can wire
 * a "prior state is vXYZ" toast.
 */
export function versionRestoreWithAutoSnapshot(
  projectDir: string,
  branch: string,
  targetId: string,
): { snapshotId: string; restored: number } {
  const snapshot = versionSnapshot(projectDir, branch, {
    label: "auto-snapshot before restore",
    createdBy: "user",
  });
  const restore = versionRestore(projectDir, targetId, "force");
  return { snapshotId: snapshot.id, restored: restore.restored };
}

export function versionGet(projectDir: string, id: string): VersionRecord {
  const db = projectDb(projectDir);
  const row = db.prepare(`SELECT * FROM versions WHERE id = ?`).get(id) as VersionRow | undefined;
  if (!row) throw E.notFound("version", id);
  return rowToVersion(row);
}

export function versionList(projectDir: string, limit = 50): VersionRecord[] {
  const db = projectDb(projectDir);
  const rows = db
    .prepare(`SELECT * FROM versions ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as VersionRow[];
  return rows.map(rowToVersion);
}

export interface VersionDiff {
  from: string;
  to: string;
  added: string[];
  removed: string[];
  changed: string[];
}

export function versionDiff(projectDir: string, from: string, to: string): VersionDiff {
  const a = versionGet(projectDir, from);
  const b = versionGet(projectDir, to);
  const aFiles = a.files;
  const bFiles = b.files;
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const allPaths = new Set([...Object.keys(aFiles), ...Object.keys(bFiles)]);
  for (const p of allPaths) {
    const ah = aFiles[p];
    const bh = bFiles[p];
    if (ah === undefined && bh !== undefined) added.push(p);
    else if (ah !== undefined && bh === undefined) removed.push(p);
    else if (ah !== bh) changed.push(p);
  }
  added.sort();
  removed.sort();
  changed.sort();
  return { from, to, added, removed, changed };
}

export function branchList(projectDir: string): BranchRecord[] {
  const db = projectDb(projectDir);
  const rows = db.prepare(`SELECT * FROM branches ORDER BY name`).all() as BranchRow[];
  return rows.map((r) => ({
    name: r.name,
    headVersionId: r.head_version_id,
    createdAt: r.created_at,
    protected: r.protected === 1,
  }));
}

export function branchCreate(
  projectDir: string,
  name: string,
  fromBranch?: string,
): BranchRecord {
  const db = projectDb(projectDir);
  const existing = db.prepare(`SELECT name FROM branches WHERE name = ?`).get(name);
  if (existing) throw E.exists("branch", name);
  const src = db
    .prepare(`SELECT head_version_id FROM branches WHERE name = ?`)
    .get(fromBranch ?? "main") as { head_version_id: string } | undefined;
  if (!src) throw E.notFound("branch", fromBranch ?? "main");
  const now = Date.now();
  db.prepare(
    `INSERT INTO branches (name, head_version_id, created_at, protected) VALUES (?, ?, ?, 0)`,
  ).run(name, src.head_version_id, now);
  return {
    name,
    headVersionId: src.head_version_id,
    createdAt: now,
    protected: false,
  };
}

interface VersionRow {
  id: string;
  parent_id: string | null;
  branch: string;
  label: string | null;
  message: string | null;
  created_at: number;
  created_by: VersionRecord["createdBy"];
  files_json: string;
}

interface BranchRow {
  name: string;
  head_version_id: string;
  created_at: number;
  protected: number;
}

function rowToVersion(row: VersionRow): VersionRecord {
  return {
    id: row.id,
    parentId: row.parent_id,
    branch: row.branch,
    label: row.label,
    message: row.message,
    createdAt: row.created_at,
    createdBy: row.created_by,
    files: JSON.parse(row.files_json) as Record<string, string>,
  };
}

export function ulidId(): string {
  return ulid();
}
