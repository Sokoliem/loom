import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serverDir } from "../core/paths.js";
import { readDaemonStatus } from "./daemon-control.js";

/**
 * Authenticated fetch to the local loom daemon. Reads the secret from
 * `~/.loom/server/secret` and includes it via X-Loom-Secret on mutating calls.
 * Returns parsed JSON or throws with the server's error message.
 */
export async function daemonFetch<T = unknown>(
  pathAndQuery: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const status = readDaemonStatus();
  if (!status.running || !status.url) {
    throw new Error("daemon not running — call daemon_start first");
  }
  const url = status.url + pathAndQuery;
  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json" },
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  if (init.method !== "GET") {
    const secret = readSecret();
    if (secret) (init.headers as Record<string, string>)["x-loom-secret"] = secret;
  }
  const r = await fetch(url, init);
  const text = await r.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!r.ok) {
    const msg = (json as { error?: string }).error ?? `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return json as T;
}

function readSecret(): string | null {
  const p = join(serverDir(), "secret");
  if (!existsSync(p)) return null;
  try {
    return readFileSync(p, "utf8").trim();
  } catch {
    return null;
  }
}
