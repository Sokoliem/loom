import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Write the studio runtime files into `<projectDir>/.loom/studio/`. Idempotent:
 * skips rewrites when content is unchanged so HMR doesn't churn.
 */
export function ensureStudioRuntime(projectDir: string): { studioDir: string } {
  const studioDir = join(projectDir, ".loom", "studio");
  mkdirSync(studioDir, { recursive: true });

  writeIfChanged(join(studioDir, "index.html"), INDEX_HTML);
  writeIfChanged(join(studioDir, "main.tsx"), MAIN_TSX);
  writeIfChanged(join(studioDir, "router.tsx"), ROUTER_TSX);
  writeIfChanged(join(studioDir, "boot.css"), BOOT_CSS);
  writeIfChanged(join(studioDir, "tsconfig.json"), JSON.stringify(TSCONFIG, null, 2));

  return { studioDir };
}

function writeIfChanged(path: string, content: string): void {
  if (existsSync(path)) {
    try {
      const cur = readFileSync(path, "utf8");
      if (cur === content) return;
    } catch {
      // ignore read errors; overwrite
    }
  }
  writeFileSync(path, content);
}

const TSCONFIG = {
  compilerOptions: {
    target: "ES2020",
    module: "ESNext",
    moduleResolution: "bundler",
    jsx: "react-jsx",
    strict: false,
    esModuleInterop: true,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
  },
  include: ["./**/*", "../../routes/**/*", "../../components/**/*"],
};

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>loom studio</title>
    <link rel="stylesheet" href="/__loom/tokens.css" />
    <link rel="stylesheet" href="./boot.css" />
  </head>
  <body>
    <div id="loom-root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
`;

const BOOT_CSS = `/* loom studio boot — minimal reset so the user's _layout owns the stage */
*,*::before,*::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; min-height: 100%; background: var(--surface-base, #fff); color: var(--text-primary, #111); }
body { font-family: var(--font-family-sans, system-ui, -apple-system, "Segoe UI", sans-serif); }
img, svg { display: block; max-width: 100%; }
button { font: inherit; cursor: pointer; }
`;

const MAIN_TSX = `import React from "react";
import { createRoot } from "react-dom/client";
import { Router } from "./router";

const routeMods = import.meta.glob("../../routes/**/*.{tsx,jsx}", { eager: false }) as Record<
  string,
  () => Promise<{ default: React.ComponentType }>
>;
const layoutMods = import.meta.glob("../../routes/_layout.{tsx,jsx}", { eager: false }) as Record<
  string,
  () => Promise<{ default: React.ComponentType<{ children: React.ReactNode }> }>
>;

// Hot-swap CSS vars without a full reload when the daemon emits a token change.
// The chrome.ts WS listener posts \`loom:tokens-changed\` here, and we re-fetch
// /__loom/tokens.css by tacking a cache-busting query param onto its <link>.
// We accept messages only from the loom daemon origin to harden against other
// localhost tabs spamming us; the daemon URL is read from the studio query.
const LOOM_DAEMON_ORIGIN = (() => {
  try {
    const p = new URL(window.location.href).searchParams.get("__loomDaemonOrigin");
    if (p) return p;
  } catch {}
  return null;
})();
function isTrustedLoomMessage(e: MessageEvent): boolean {
  // Same-origin (the chrome iframe-parents us across origins, so the parent's
  // origin is the daemon's; messages from the parent count as trusted).
  if (e.source && e.source === window.parent) return true;
  if (LOOM_DAEMON_ORIGIN && e.origin === LOOM_DAEMON_ORIGIN) return true;
  return e.origin === window.location.origin;
}
window.addEventListener("message", (e: MessageEvent) => {
  if (!isTrustedLoomMessage(e)) return;
  if ((e as any)?.data?.kind !== "loom:tokens-changed") return;
  const link = document.querySelector<HTMLLinkElement>('link[href*="/__loom/tokens.css"]');
  if (!link) return;
  try {
    const u = new URL(link.href, location.origin);
    u.searchParams.set("ts", String(Date.now()));
    link.href = u.toString();
  } catch {
    /* noop */
  }
});

createRoot(document.getElementById("loom-root")!).render(
  <React.StrictMode>
    <Router routeMods={routeMods} layoutMods={layoutMods} />
  </React.StrictMode>,
);
`;

const ROUTER_TSX = `import React, { Suspense, useEffect, useState } from "react";

type LoaderMap = Record<string, () => Promise<{ default: React.ComponentType }>>;
type LayoutLoaderMap = Record<
  string,
  () => Promise<{ default: React.ComponentType<{ children: React.ReactNode }> }>
>;

function fileToRoutePath(file: string): string | null {
  // file looks like "../../routes/foo/bar.tsx" or "../../routes/index.tsx"
  const m = file.match(/\\/routes\\/(.+?)\\.(tsx|jsx)$/);
  if (!m) return null;
  let rel = m[1];
  if (rel.startsWith("_")) return null; // _layout, _404, etc.
  if (rel === "index") return "/";
  rel = rel.replace(/\\\\/g, "/");
  if (rel.endsWith("/index")) rel = rel.slice(0, -"/index".length);
  return "/" + rel;
}

function indexRoutes(routeMods: LoaderMap): Map<string, () => Promise<{ default: React.ComponentType }>> {
  const out = new Map<string, () => Promise<{ default: React.ComponentType }>>();
  for (const [file, loader] of Object.entries(routeMods)) {
    const p = fileToRoutePath(file);
    if (p) out.set(p, loader);
  }
  return out;
}

function pickRoute(): string {
  const url = new URL(window.location.href);
  const q = url.searchParams.get("route");
  if (q) return q.startsWith("/") ? q : "/" + q;
  return url.pathname === "/" ? "/" : url.pathname;
}

const NotFound: React.FC<{ path: string; known: string[] }> = ({ path, known }) => (
  <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
    <h2 style={{ margin: 0 }}>No route at {path}</h2>
    <p style={{ color: "#666" }}>Known routes:</p>
    <ul>
      {known.sort().map((p) => (
        <li key={p}>
          <a href={"?route=" + encodeURIComponent(p)}>{p}</a>
        </li>
      ))}
    </ul>
  </main>
);

export const Router: React.FC<{ routeMods: LoaderMap; layoutMods: LayoutLoaderMap }> = ({ routeMods, layoutMods }) => {
  const index = React.useMemo(() => indexRoutes(routeMods), [routeMods]);
  const [path, setPath] = useState(pickRoute());

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Only trust the parent iframe (the loom chrome) — other localhost tabs
      // shouldn't be able to drive our route or theme.
      if (e.source !== window.parent && e.origin !== window.location.origin) return;
      if (e?.data?.kind === "loom:route") setPath(e.data.path || "/");
      if (e?.data?.kind === "loom:theme") {
        const t = e.data.theme === "dark" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", t);
      }
    };
    window.addEventListener("message", onMessage);
    // honor initial theme from query string
    const t = new URL(window.location.href).searchParams.get("theme");
    if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.setAttribute("data-theme", "light");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const loader = index.get(path);
  if (!loader) return <NotFound path={path} known={Array.from(index.keys())} />;

  const Page = React.lazy(loader);
  const layoutEntry = Object.entries(layoutMods)[0];
  const Layout = layoutEntry
    ? React.lazy(layoutEntry[1])
    : (({ children }: { children: React.ReactNode }) => <>{children}</>);

  return (
    <Suspense fallback={<div style={{ padding: 24, color: "#888" }}>loading…</div>}>
      <Layout>
        <Page />
      </Layout>
    </Suspense>
  );
};
`;
