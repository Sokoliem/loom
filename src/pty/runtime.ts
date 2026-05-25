import { createClaudeRuntime, type ClaudeSessionRuntime } from "@celestial/forge";
import { PtyScreenBuffer } from "@celestial/lens";
import type { ProjectRecord } from "../types.js";

const DEFAULT_COLS = 100;
const DEFAULT_ROWS = 30;

export interface ClaudeSession {
  projectId: string;
  runtime: ClaudeSessionRuntime;
  screen: PtyScreenBuffer;
  cols: number;
  rows: number;
  startedAt: number;
  onFrame: (cb: () => void) => () => void;
  onExit: (cb: (exitCode: number | null) => void) => () => void;
}

const sessions = new Map<string, Promise<ClaudeSession>>();

/**
 * Start (or return) a claude session for the given project.
 *
 * Composes:
 *   - `forge.createClaudeRuntime` — owns the claude PTY + IPC channel + hooks
 *   - `lens.PtyScreenBuffer` (re-exported from `@celestial/portal`) — VT100
 *     state machine that interprets the PTY's raw output into a cell grid
 *     suitable for browser-side rendering by `@celestial/rift`.
 */
export function ensureClaudeSession(project: ProjectRecord): Promise<ClaudeSession> {
  const cached = sessions.get(project.id);
  if (cached) return cached;
  const p = bootSession(project).catch((err) => {
    sessions.delete(project.id);
    throw err;
  });
  sessions.set(project.id, p);
  return p;
}

export function getClaudeSession(projectId: string): Promise<ClaudeSession> | undefined {
  return sessions.get(projectId);
}

export async function stopClaudeSession(projectId: string): Promise<void> {
  const p = sessions.get(projectId);
  if (!p) return;
  sessions.delete(projectId);
  try {
    const s = await p;
    await s.runtime.dispose();
  } catch {
    // dispose is idempotent + swallows errors; nothing else to do
  }
}

export async function stopAllClaudeSessions(): Promise<void> {
  const all = Array.from(sessions.values());
  sessions.clear();
  await Promise.allSettled(
    all.map(async (p) => {
      const s = await p;
      await s.runtime.dispose();
    }),
  );
}

async function bootSession(project: ProjectRecord): Promise<ClaudeSession> {
  const cols = DEFAULT_COLS;
  const rows = DEFAULT_ROWS;

  const runtime = await createClaudeRuntime({
    claudeExecutable: "claude",
    claudeArgs: [],
    cwd: project.path,
    cols,
    rows,
  });

  const screen = new PtyScreenBuffer(cols, rows);
  const frameListeners = new Set<() => void>();
  const exitListeners = new Set<(code: number | null) => void>();

  const removeData = runtime.ptyHandle.onData((chunk) => {
    screen.write(chunk);
    for (const cb of frameListeners) {
      try {
        cb();
      } catch {
        // ignore listener errors so one bad subscriber can't break the others
      }
    }
  });

  runtime.ptyHandle.onExit((ev) => {
    sessions.delete(project.id);
    const code = typeof ev.exitCode === "number" ? ev.exitCode : null;
    for (const cb of exitListeners) {
      try {
        cb(code);
      } catch {
        // ignore
      }
    }
    removeData();
  });

  return {
    projectId: project.id,
    runtime,
    screen,
    cols,
    rows,
    startedAt: Date.now(),
    onFrame(cb) {
      frameListeners.add(cb);
      return () => frameListeners.delete(cb);
    },
    onExit(cb) {
      exitListeners.add(cb);
      return () => exitListeners.delete(cb);
    },
  };
}

export function sessionStatus(projectId: string): {
  running: boolean;
  pid?: number;
  cols?: number;
  rows?: number;
  startedAt?: number;
} {
  const p = sessions.get(projectId);
  if (!p) return { running: false };
  // p is a Promise, but the session is already booted by the time we get here
  // if anyone has called ensure → await for the initial start. Fast-path:
  // best-effort sync peek via a side-channel isn't worth the complexity.
  // Callers that need this synchronously should call ensure + await.
  return { running: true };
}

/** Wait for the session promise and return a public-safe status object. */
export async function sessionStatusAsync(projectId: string): Promise<{
  running: boolean;
  pid?: number;
  cols?: number;
  rows?: number;
  startedAt?: number;
}> {
  const p = sessions.get(projectId);
  if (!p) return { running: false };
  const s = await p;
  return {
    running: !s.runtime.disposed,
    pid: s.runtime.ptyHandle.pid,
    cols: s.cols,
    rows: s.rows,
    startedAt: s.startedAt,
  };
}
