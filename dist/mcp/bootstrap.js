#!/usr/bin/env node
import { createRequire as __loomCreateRequire } from 'node:module';
const require = __loomCreateRequire(import.meta.url);

// src/mcp/bootstrap.ts
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
var here = dirname(fileURLToPath(import.meta.url));
var pluginRoot = resolve(here, "..", "..");
var serverPath = resolve(here, "server.js");
function nativeDepsAvailable() {
  try {
    createRequire(import.meta.url)("better-sqlite3");
    return true;
  } catch {
    return false;
  }
}
function installNativeDeps() {
  process.stderr.write(
    `[loom] native dependency missing \u2014 running one-time install in ${pluginRoot}
[loom] (this can take 30-90s; subsequent starts are instant)
`
  );
  if (!existsSync(resolve(pluginRoot, "package.json"))) {
    process.stderr.write(`[loom] ERROR: no package.json in ${pluginRoot}; cannot install
`);
    return false;
  }
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    npmCmd,
    ["install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"],
    {
      cwd: pluginRoot,
      stdio: ["ignore", 2, 2],
      shell: process.platform === "win32"
    }
  );
  if (result.status !== 0) {
    process.stderr.write(`[loom] npm install failed (exit ${result.status ?? "null"})
`);
    return false;
  }
  process.stderr.write(`[loom] install complete; starting MCP server
`);
  return true;
}
if (!nativeDepsAvailable()) {
  if (!installNativeDeps() || !nativeDepsAvailable()) {
    process.exit(1);
  }
}
var child = spawnSync(process.execPath, [serverPath], { stdio: "inherit" });
process.exit(child.status ?? 0);
//# sourceMappingURL=bootstrap.js.map