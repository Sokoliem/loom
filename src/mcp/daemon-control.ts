import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serverPidPath, serverPortPath } from "../core/paths.js";

export interface DaemonStatus {
  running: boolean;
  pid?: number;
  port?: number;
  url?: string;
  stageUrl?: string;
}

/** Probe the local pid/port files written by the daemon at startup. */
export function readDaemonStatus(): DaemonStatus {
  const pidPath = serverPidPath();
  const portPath = serverPortPath();
  if (!existsSync(pidPath) || !existsSync(portPath)) return { running: false };
  try {
    const pid = Number.parseInt(readFileSync(pidPath, "utf8").trim(), 10);
    const port = Number.parseInt(readFileSync(portPath, "utf8").trim(), 10);
    if (!Number.isFinite(pid) || !Number.isFinite(port)) return { running: false };
    if (!isAlive(pid)) return { running: false };
    return {
      running: true,
      pid,
      port,
      url: `http://127.0.0.1:${port}`,
    };
  } catch {
    return { running: false };
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

/** Resolve the daemon entry script — co-located with the MCP server in the same dist tree. */
function daemonScript(): string {
  // this file is built to dist/mcp/daemon-control.js; daemon.js lives at dist/daemon.js
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "daemon.js");
}

/**
 * Spawn the daemon detached so it survives this MCP session. Returns the URL
 * after waiting briefly for the pid/port files to appear.
 */
export async function startDaemonDetached(): Promise<DaemonStatus> {
  const existing = readDaemonStatus();
  if (existing.running) return existing;

  const script = daemonScript();
  if (!existsSync(script)) {
    throw new Error(`daemon script not found at ${script}`);
  }

  const child = spawn(process.execPath, [script], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();

  // Wait up to ~6s for the daemon to write its run files.
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const s = readDaemonStatus();
    if (s.running) return s;
  }
  throw new Error("daemon failed to start within 6s; check ~/.loom/server/ for logs");
}

/** Send SIGTERM to the daemon pid (if any). */
export function stopDaemonDetached(): DaemonStatus {
  const status = readDaemonStatus();
  if (!status.running || !status.pid) return { running: false };
  try {
    process.kill(status.pid, "SIGTERM");
  } catch {
    // ignore; process might already be gone
  }
  return { running: false };
}
