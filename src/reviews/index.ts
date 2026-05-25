import { ulid } from "ulid";
import { E } from "../core/errors.js";
import { projectDb } from "../core/project.js";
import type { ReviewMessage, ReviewThread } from "../types.js";

export interface CreateThreadInput {
  projectDir: string;
  routePath: string;
  elementSelector: string;
  viewport: string;
  versionId: string;
  source: ReviewThread["source"];
  author: string;
  body: string;
  severity?: ReviewMessage["severity"];
  agent?: string | null;
}

export function reviewCreate(input: CreateThreadInput): ReviewThread {
  const id = ulid();
  const ts = Date.now();
  const msg: ReviewMessage = {
    id: ulid(),
    author: input.author,
    body: input.body,
    severity: input.severity ?? null,
    agent: input.agent ?? null,
    screenshotHash: null,
    ts,
  };
  const thread: ReviewThread = {
    id,
    routePath: input.routePath,
    elementSelector: input.elementSelector,
    viewport: input.viewport,
    versionId: input.versionId,
    status: "open",
    source: input.source,
    createdAt: ts,
    resolvedAt: null,
    messages: [msg],
  };
  projectDb(input.projectDir)
    .prepare(
      `INSERT INTO review_threads (id, route_path, element_selector, viewport, version_id, status, source, created_at, resolved_at, messages_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    )
    .run(
      id,
      input.routePath,
      input.elementSelector,
      input.viewport,
      input.versionId,
      "open",
      input.source,
      ts,
      JSON.stringify([msg]),
    );
  return thread;
}

export function reviewList(
  projectDir: string,
  filters: { routePath?: string; status?: ReviewThread["status"] } = {},
): ReviewThread[] {
  const db = projectDb(projectDir);
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filters.routePath) {
    clauses.push("route_path = ?");
    params.push(filters.routePath);
  }
  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM review_threads ${where} ORDER BY created_at DESC`)
    .all(...params) as ReviewRow[];
  return rows.map(rowToThread);
}

export function reviewGet(projectDir: string, id: string): ReviewThread {
  const row = projectDb(projectDir)
    .prepare(`SELECT * FROM review_threads WHERE id = ?`)
    .get(id) as ReviewRow | undefined;
  if (!row) throw E.notFound("review", id);
  return rowToThread(row);
}

export function reviewResolve(
  projectDir: string,
  id: string,
  resolution: "resolved" | "rejected",
): ReviewThread {
  const t = reviewGet(projectDir, id);
  const now = Date.now();
  projectDb(projectDir)
    .prepare(`UPDATE review_threads SET status = ?, resolved_at = ? WHERE id = ?`)
    .run(resolution, now, id);
  return { ...t, status: resolution, resolvedAt: now };
}

interface ReviewRow {
  id: string;
  route_path: string;
  element_selector: string;
  viewport: string;
  version_id: string;
  status: ReviewThread["status"];
  source: ReviewThread["source"];
  created_at: number;
  resolved_at: number | null;
  messages_json: string;
}

function rowToThread(r: ReviewRow): ReviewThread {
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
    messages: JSON.parse(r.messages_json) as ReviewMessage[],
  };
}
