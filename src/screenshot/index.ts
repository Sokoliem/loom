import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { snapshotsDir } from "../core/paths.js";
import type { ProjectRecord } from "../types.js";

export interface ScreenshotOptions {
  /** Route path, e.g. "/" or "/policies". */
  path: string;
  /** Viewport spec: "desktop" | "tablet" | "mobile" | "WxH" (e.g. "1280x800"). */
  viewport?: string;
  /** Theme to render at: "light" | "dark". */
  theme?: "light" | "dark";
  /** When true, capture the whole scrollable page; otherwise just the viewport. */
  fullPage?: boolean;
}

export interface ScreenshotResult {
  ok: true;
  file: string;
  bytes: number;
  width: number;
  height: number;
  viewport: string;
  theme: "light" | "dark";
}

export interface ScreenshotUnavailable {
  ok: false;
  reason: string;
}

const VIEWPORT_PRESETS: Record<string, { width: number; height: number }> = {
  mobile: { width: 360, height: 720 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1440, height: 900 },
};

export function parseViewport(spec: string | undefined): { width: number; height: number } {
  if (!spec) return VIEWPORT_PRESETS.desktop;
  const preset = VIEWPORT_PRESETS[spec];
  if (preset) return preset;
  const m = spec.match(/^(\d{2,5})x(\d{2,5})$/);
  if (m) return { width: parseInt(m[1]!, 10), height: parseInt(m[2]!, 10) };
  return VIEWPORT_PRESETS.desktop;
}

function slug(path: string): string {
  if (path === "/" || path === "") return "_index";
  return path.replace(/^\//, "").replace(/[\/\\]/g, "_").replace(/[^\w.-]/g, "_") || "_index";
}

/**
 * Render a route into a PNG via playwright (lazy-loaded). The viteUrl is the
 * project's Vite dev server origin (e.g. http://127.0.0.1:5173); the route is
 * appended via `?route=...&theme=...` to match the studio runtime's pickRoute()
 * behavior. Snapshots land under `<project>/.loom/snapshots/`.
 */
export async function captureRouteScreenshot(
  project: ProjectRecord,
  viteUrl: string,
  opts: ScreenshotOptions,
): Promise<ScreenshotResult | ScreenshotUnavailable> {
  let playwright: typeof import("playwright") | null = null;
  try {
    playwright = await import("playwright");
  } catch {
    return {
      ok: false,
      reason:
        "playwright not installed — run `pnpm add -D playwright && pnpm exec playwright install chromium`",
    };
  }

  const theme: "light" | "dark" = opts.theme === "dark" ? "dark" : "light";
  const viewportSpec = opts.viewport ?? "desktop";
  const { width, height } = parseViewport(viewportSpec);
  const url = new URL(viteUrl);
  url.searchParams.set("route", opts.path);
  url.searchParams.set("theme", theme);

  const dir = snapshotsDir(project.path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, `${slug(opts.path)}_${viewportSpec}_${theme}.png`);

  let browser: import("playwright").Browser | null = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 30000 });
    // Give React + token CSS one more frame to settle after networkidle.
    await page.waitForTimeout(250);
    const buf = await page.screenshot({ path: file, fullPage: !!opts.fullPage, type: "png" });
    return {
      ok: true,
      file,
      bytes: buf.length,
      width,
      height,
      viewport: viewportSpec,
      theme,
    };
  } catch (err) {
    return { ok: false, reason: `screenshot failed: ${(err as Error).message}` };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* noop */
      }
    }
  }
}
