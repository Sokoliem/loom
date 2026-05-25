import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..", "..");
const serverPath = resolve(here, "server.js");

function nativeDepsAvailable(): boolean {
  try {
    createRequire(import.meta.url)("better-sqlite3");
    return true;
  } catch {
    return false;
  }
}

function installNativeDeps(): boolean {
  process.stderr.write(
    `[loom] native dependency missing — running one-time install in ${pluginRoot}\n` +
      `[loom] (this can take 30-90s; subsequent starts are instant)\n`,
  );
  if (!existsSync(resolve(pluginRoot, "package.json"))) {
    process.stderr.write(`[loom] ERROR: no package.json in ${pluginRoot}; cannot install\n`);
    return false;
  }
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    npmCmd,
    ["install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"],
    {
      cwd: pluginRoot,
      stdio: ["ignore", 2, 2],
      shell: process.platform === "win32",
    },
  );
  if (result.status !== 0) {
    process.stderr.write(`[loom] npm install failed (exit ${result.status ?? "null"})\n`);
    return false;
  }
  process.stderr.write(`[loom] install complete; starting MCP server\n`);
  return true;
}

if (!nativeDepsAvailable()) {
  if (!installNativeDeps() || !nativeDepsAvailable()) {
    process.exit(1);
  }
}

const child = spawnSync(process.execPath, [serverPath], { stdio: "inherit" });
process.exit(child.status ?? 0);
