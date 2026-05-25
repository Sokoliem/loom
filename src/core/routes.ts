import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { E } from "./errors.js";
import { routesDir } from "./paths.js";

export interface RouteRecord {
  path: string; // e.g., "/" or "/pricing"
  file: string; // absolute file path
  meta: RouteMeta;
}

export interface RouteMeta {
  title?: string;
  state?: "draft" | "in-review" | "approved";
  description?: string;
  data?: string; // mockdata binding name
}

const META_RE = /export\s+const\s+meta\s*=\s*({[\s\S]*?});/;
const PATH_RE = /^\/[a-z0-9-]*(\/[a-z0-9-]+)*$/;

export function routeCreate(
  projectDir: string,
  path: string,
  body: string,
  meta?: RouteMeta,
): RouteRecord {
  if (!PATH_RE.test(path)) {
    throw E.invalid("route path", "lowercase, hyphen-separated, leading slash (e.g., /pricing)");
  }
  const file = routePathToFile(projectDir, path);
  if (existsSync(file)) throw E.exists("route", path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, composeRoute(body, meta));
  return { path, file, meta: meta ?? {} };
}

export function routeGet(projectDir: string, path: string): RouteRecord {
  const file = routePathToFile(projectDir, path);
  if (!existsSync(file)) throw E.notFound("route", path);
  return { path, file, meta: extractMeta(readFileSync(file, "utf8")) };
}

export function routeList(projectDir: string): RouteRecord[] {
  const dir = routesDir(projectDir);
  if (!existsSync(dir)) return [];
  const out: RouteRecord[] = [];
  walk(dir, (file) => {
    if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) return;
    const rel = relative(dir, file).split(sep).join("/");
    if (rel.startsWith("_")) return;
    const path = filePathToRoute(rel);
    if (!path) return;
    out.push({ path, file, meta: extractMeta(readFileSync(file, "utf8")) });
  });
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export interface RoutePatch {
  body?: string;
  meta?: RouteMeta;
}

export function routeUpdate(projectDir: string, path: string, patch: RoutePatch): RouteRecord {
  const rec = routeGet(projectDir, path);
  const current = readFileSync(rec.file, "utf8");
  const newBody = patch.body ?? stripMeta(current);
  const newMeta = patch.meta ?? rec.meta;
  writeFileSync(rec.file, composeRoute(newBody, newMeta));
  return { ...rec, meta: newMeta };
}

export function routeDelete(projectDir: string, path: string): void {
  const file = routePathToFile(projectDir, path);
  if (!existsSync(file)) throw E.notFound("route", path);
  rmSync(file);
}

function routePathToFile(projectDir: string, path: string): string {
  const dir = routesDir(projectDir);
  if (path === "/") return join(dir, "index.tsx");
  const parts = path.replace(/^\//, "").split("/");
  const last = parts.pop()!;
  return join(dir, ...parts, `${last}.tsx`);
}

function filePathToRoute(rel: string): string | null {
  let p = rel.replace(/\.(tsx|jsx)$/, "");
  if (p === "index") return "/";
  if (p.endsWith("/index")) p = p.slice(0, -"/index".length);
  return `/${p}`;
}

function walk(dir: string, fn: (file: string) => void): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, fn);
    } else {
      fn(full);
    }
  }
}

function composeRoute(body: string, meta?: RouteMeta): string {
  const metaLine = meta && Object.keys(meta).length > 0
    ? `export const meta = ${JSON.stringify(meta, null, 2)};\n\n`
    : "";
  return `${metaLine}${body.trim()}\n`;
}

function stripMeta(source: string): string {
  return source.replace(META_RE, "").replace(/^\s+/, "");
}

function extractMeta(source: string): RouteMeta {
  const m = source.match(META_RE);
  if (!m) return {};
  try {
    return JSON.parse(m[1]!) as RouteMeta;
  } catch {
    return {};
  }
}
