/**
 * Activity-event store for the project-management chrome surface (v0.10.0).
 *
 * Append-only event log per project, retained at MAX_PER_PROJECT events. Reads
 * are ordered newest-first via the `idx_activity_project_created` index.
 *
 * Producers (chokidar watcher, forge runtime, panel runtime, session lifecycle)
 * call `activityInsert`; the in-memory `activityBus` re-emits the event so the
 * daemon's WS handler can push to subscribed chrome clients without re-querying
 * SQLite.
 */

import { EventEmitter } from "node:events";
import { ulid } from "ulid";
import { server } from "./project.js";
import type { ActivityEvent, ActivityKind, ProjectId } from "../types.js";

const MAX_PER_PROJECT = 1000;
const TRIM_BATCH_INTERVAL = 50;

let _inserts = 0;

export interface ActivityInsertInput {
  projectId: ProjectId;
  kind: ActivityKind;
  subkind?: string | null;
  title: string;
  refPath?: string | null;
  refId?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt?: number;
}

class ActivityBus extends EventEmitter {
  emitEvent(event: ActivityEvent): void {
    this.emit("event", event);
    this.emit(`event:${event.projectId}`, event);
  }
}

export const activityBus = new ActivityBus();

export function activityInsert(input: ActivityInsertInput): ActivityEvent {
  const event: ActivityEvent = {
    id: ulid(),
    projectId: input.projectId,
    kind: input.kind,
    subkind: input.subkind ?? null,
    title: input.title,
    refPath: input.refPath ?? null,
    refId: input.refId ?? null,
    payload: input.payload ?? null,
    createdAt: input.createdAt ?? Date.now(),
  };
  server()
    .prepare(
      `INSERT INTO activity_events (id, project_id, kind, subkind, title, ref_path, ref_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.id,
      event.projectId,
      event.kind,
      event.subkind,
      event.title,
      event.refPath,
      event.refId,
      event.payload ? JSON.stringify(event.payload) : null,
      event.createdAt,
    );
  _inserts += 1;
  if (_inserts % TRIM_BATCH_INTERVAL === 0) {
    activityTrim(event.projectId);
  }
  activityBus.emitEvent(event);
  return event;
}

export interface ActivityListOptions {
  limit?: number;
  kinds?: readonly ActivityKind[];
}

interface ActivityRow {
  id: string;
  project_id: string;
  kind: string;
  subkind: string | null;
  title: string;
  ref_path: string | null;
  ref_id: string | null;
  payload: string | null;
  created_at: number;
}

export function activityList(projectId: ProjectId, opts: ActivityListOptions = {}): ActivityEvent[] {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 500));
  const kinds = opts.kinds && opts.kinds.length > 0 ? [...opts.kinds] : null;
  const stmt = kinds
    ? server().prepare(
        `SELECT * FROM activity_events
         WHERE project_id = ?
           AND kind IN (${kinds.map(() => "?").join(",")})
         ORDER BY created_at DESC
         LIMIT ?`,
      )
    : server().prepare(
        `SELECT * FROM activity_events
         WHERE project_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      );
  const rows = (kinds
    ? stmt.all(projectId, ...kinds, limit)
    : stmt.all(projectId, limit)) as ActivityRow[];
  return rows.map(rowToEvent);
}

export function activityTrim(projectId: ProjectId, max: number = MAX_PER_PROJECT): number {
  const result = server()
    .prepare(
      `DELETE FROM activity_events
       WHERE project_id = ?
         AND id NOT IN (
           SELECT id FROM activity_events
           WHERE project_id = ?
           ORDER BY created_at DESC
           LIMIT ?
         )`,
    )
    .run(projectId, projectId, max);
  return result.changes;
}

function rowToEvent(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind as ActivityKind,
    subkind: row.subkind,
    title: row.title,
    refPath: row.ref_path,
    refId: row.ref_id,
    payload: row.payload ? (JSON.parse(row.payload) as Record<string, unknown>) : null,
    createdAt: row.created_at,
  };
}
