/**
 * Local-only JSONL telemetry. One line per event, append-only, no rotation
 * (size grows with usage; bounded indirectly by user disk space and run-length).
 *
 * Gated by `LOOM_TELEMETRY=1` — when off, all emit calls are a no-op.
 *
 * Never transmitted. Events are purely for the user's own usage analysis
 * (e.g., to compute `project_switch_p50_ms` for the v0.10.0 PRD metrics).
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { loomHome } from "./paths.js";

let _path: string | null = null;
function telemetryPath(): string {
  if (_path) return _path;
  _path = join(loomHome(), "telemetry.jsonl");
  mkdirSync(dirname(_path), { recursive: true });
  return _path;
}

export interface TelemetryEvent {
  event: string;
  ts?: number;
  [key: string]: unknown;
}

export function emit(event: TelemetryEvent): void {
  if (!config.telemetry) return;
  const line = JSON.stringify({ ts: Date.now(), ...event }) + "\n";
  try {
    appendFileSync(telemetryPath(), line, "utf8");
  } catch {
    // Telemetry failures must never block the caller.
  }
}

/** Test-only: override the destination path. */
export function _setTelemetryPathForTests(path: string | null): void {
  _path = path;
  if (path) mkdirSync(dirname(path), { recursive: true });
}
