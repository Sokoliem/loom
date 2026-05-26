/**
 * Lightweight `git status` query for the studio chrome header.
 * - 2s hard timeout (slow network mounts, lock files) — failure returns a stale
 *   sentinel; the chrome shows "—" in that case rather than blocking the header.
 * - 2s in-memory cache per project path so route/viewport changes don't fire a
 *   shell-out storm.
 */

import { execFile } from "node:child_process";

export interface GitStatus {
  branch: string | null;
  dirty: boolean;
  ahead: number;
  behind: number;
  /** True when the cache returned a previously-computed value (no fresh shell-out). */
  cached?: boolean;
  /** True when the underlying git invocation failed or timed out. */
  stale?: boolean;
}

interface CacheEntry {
  at: number;
  value: GitStatus;
}

const CACHE_TTL_MS = 2000;
const TIMEOUT_MS = 2000;
const cache = new Map<string, CacheEntry>();

export async function gitStatus(projectPath: string): Promise<GitStatus> {
  const cached = cache.get(projectPath);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ...cached.value, cached: true };
  }
  const fresh = await runGitStatus(projectPath);
  cache.set(projectPath, { at: Date.now(), value: fresh });
  return fresh;
}

/** Test-only: drop the cache so a fresh shell-out happens on the next call. */
export function _resetGitStatusCache(): void {
  cache.clear();
}

function runGitStatus(projectPath: string): Promise<GitStatus> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["status", "--porcelain=v2", "--branch"],
      {
        cwd: projectPath,
        env: process.env,
        shell: false,
        windowsHide: true,
        timeout: TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
      },
      (err, stdout) => {
        if (err) {
          resolve({ branch: null, dirty: false, ahead: 0, behind: 0, stale: true });
          return;
        }
        resolve(parsePorcelainV2(stdout?.toString() ?? ""));
      },
    );
  });
}

export function parsePorcelainV2(out: string): GitStatus {
  let branch: string | null = null;
  let ahead = 0;
  let behind = 0;
  let dirty = false;
  for (const rawLine of out.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("# branch.head ")) {
      const head = line.slice("# branch.head ".length).trim();
      branch = head === "(detached)" ? null : head;
    } else if (line.startsWith("# branch.ab ")) {
      const m = line.match(/\+(\d+) -(\d+)/);
      if (m) {
        ahead = Number(m[1]);
        behind = Number(m[2]);
      }
    } else if (line.startsWith("# ")) {
      // other header — ignore
    } else {
      // Any non-header line in porcelain v2 indicates modified/untracked/etc.
      dirty = true;
    }
  }
  return { branch, dirty, ahead, behind };
}
