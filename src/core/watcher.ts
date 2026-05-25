import chokidar from "chokidar";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assetsDir,
  componentsDir,
  loomCacheDir,
  mockDataDir,
  projectManifestPath,
  routesDir,
  tokensDir,
} from "./paths.js";
import { buildManifest } from "./version.js";

export type WatchEvent =
  | { kind: "route_changed"; path: string }
  | { kind: "manifest_changed"; from: string | null; to: string };

export type WatchListener = (event: WatchEvent) => void;

export interface WatcherHandle {
  close: () => Promise<void>;
}

export function startWatcher(projectDir: string, listener: WatchListener): WatcherHandle {
  const targets = [
    projectManifestPath(projectDir),
    tokensDir(projectDir),
    componentsDir(projectDir),
    routesDir(projectDir),
    mockDataDir(projectDir),
    assetsDir(projectDir),
  ].filter(existsSync);

  let lastManifestHash: string | null = readManifestHash(projectDir);

  const watcher = chokidar.watch(targets, {
    ignoreInitial: true,
    ignored: (path) => path.includes(".loom") || path.includes("node_modules"),
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
  });

  let debounce: NodeJS.Timeout | null = null;
  const flush = () => {
    debounce = null;
    const manifest = buildManifest(projectDir);
    if (manifest.hash !== lastManifestHash) {
      const from = lastManifestHash;
      lastManifestHash = manifest.hash;
      writeManifestHash(projectDir, manifest.hash);
      listener({ kind: "manifest_changed", from, to: manifest.hash });
    }
  };

  const routesRoot = routesDir(projectDir);
  const componentsRoot = componentsDir(projectDir);
  const onEvent = (file: string) => {
    const isRouteFile =
      file.startsWith(routesRoot) && (file.endsWith(".tsx") || file.endsWith(".jsx"));
    const isComponentFile =
      file.startsWith(componentsRoot) && (file.endsWith(".tsx") || file.endsWith(".jsx"));
    if (isRouteFile || isComponentFile) {
      listener({ kind: "route_changed", path: file });
    }
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(flush, 100);
  };

  watcher.on("add", onEvent).on("change", onEvent).on("unlink", onEvent);

  return {
    close: async () => {
      if (debounce) clearTimeout(debounce);
      await watcher.close();
    },
  };
}

function manifestHashPath(projectDir: string): string {
  return join(loomCacheDir(projectDir), "manifest-hash");
}

function readManifestHash(projectDir: string): string | null {
  try {
    const f = manifestHashPath(projectDir);
    if (!existsSync(f)) return null;
    return readFileSync(f, "utf8").trim();
  } catch {
    return null;
  }
}

function writeManifestHash(projectDir: string, hash: string): void {
  const dir = loomCacheDir(projectDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(manifestHashPath(projectDir), hash);
}
