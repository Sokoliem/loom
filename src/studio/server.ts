import { createServer as createViteServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { tokensToCss } from "./tokens-to-css.js";
import { ensureStudioRuntime } from "./runtime.js";
import loomIds from "../vite-plugin-loom-ids/index.js";
import type { ProjectRecord } from "../types.js";

export interface StudioInstance {
  vite: ViteDevServer;
  port: number;
  url: string;
  projectId: string;
  stop: () => Promise<void>;
}

const instances = new Map<string, Promise<StudioInstance>>();

/**
 * Start (or return cached) per-project Vite dev server. Lazy and idempotent.
 * Each project's studio runtime lives under `<projectDir>/.loom/studio/` and
 * uses `import.meta.glob` to discover the project's routes + components.
 */
export function ensureStudio(project: ProjectRecord): Promise<StudioInstance> {
  const cached = instances.get(project.id);
  if (cached) return cached;

  const p = bootStudio(project).catch((err) => {
    instances.delete(project.id);
    throw err;
  });
  instances.set(project.id, p);
  return p;
}

async function bootStudio(project: ProjectRecord): Promise<StudioInstance> {
  ensureStudioRuntime(project.path);
  const studioDir = resolve(project.path, ".loom", "studio");

  const vite = await createViteServer({
    root: studioDir,
    cacheDir: resolve(project.path, ".loom", "vite-cache"),
    logLevel: "warn",
    configFile: false,
    appType: "spa",
    clearScreen: false,
    server: {
      host: "127.0.0.1",
      port: 0, // any free port
      strictPort: false,
      hmr: { host: "127.0.0.1" },
      fs: {
        // Allow Vite to read files outside the root (the project's routes/, components/, tokens/)
        allow: [project.path, studioDir],
      },
    },
    plugins: [
      react(),
      loomIds({ projectRoot: project.path }) as never,
      loomTokensPlugin(project.path),
    ],
    resolve: {
      alias: {
        "@routes": resolve(project.path, "routes"),
        "@components": resolve(project.path, "components"),
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client"],
    },
  });

  await vite.listen();
  const address = vite.httpServer?.address();
  const port =
    typeof address === "object" && address ? address.port : undefined;
  if (!port) {
    await vite.close();
    throw new Error("vite dev server failed to bind to a port");
  }
  const url = `http://127.0.0.1:${port}`;

  return {
    vite,
    port,
    url,
    projectId: project.id,
    stop: async () => {
      await vite.close();
      instances.delete(project.id);
    },
  };
}

/** Vite plugin that serves `/__loom/tokens.css` from the project's token YAML. */
function loomTokensPlugin(projectDir: string) {
  return {
    name: "loom:tokens",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/__loom/tokens.css", (_req, res) => {
        try {
          const css = tokensToCss(projectDir);
          res.setHeader("content-type", "text/css; charset=utf-8");
          res.setHeader("cache-control", "no-store");
          res.end(css);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("content-type", "text/css");
          res.end(`/* loom token error: ${(err as Error).message} */`);
        }
      });
    },
  };
}

/** Stop all running studio instances. */
export async function stopAllStudios(): Promise<void> {
  const all = Array.from(instances.values());
  instances.clear();
  await Promise.allSettled(all.map(async (p) => (await p).stop()));
}

/** Touch token CSS — used by file-watcher integration to force a token reload. */
export function reloadTokens(projectId: string): void {
  const cached = instances.get(projectId);
  if (!cached) return;
  cached
    .then((inst) => {
      inst.vite.ws.send({ type: "full-reload", path: "*" });
    })
    .catch(() => {
      // ignore; instance may have crashed/closed
    });
}

/** Trigger a Vite full reload (used for non-module changes). */
export function fullReload(projectId: string): void {
  reloadTokens(projectId);
}
