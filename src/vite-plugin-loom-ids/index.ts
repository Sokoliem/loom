import { readFileSync } from "node:fs";
import { relative } from "node:path";
import MagicString from "magic-string";
import { createHash } from "node:crypto";
import { parseFile, walkAll, type Node } from "../validate/ast-utils.js";

export interface LoomIdsPluginOptions {
  /** Root the plugin computes file paths relative to (default: process.cwd()). */
  projectRoot?: string;
  /** Attribute name to inject (default: "data-loom-id"). */
  attrName?: string;
  /** Whether to also write a deterministic build-time map. */
  emitMap?: boolean;
  /** Cache by content hash to avoid re-walking unchanged files. */
  cache?: boolean;
}

interface InjectionPoint {
  start: number;
  id: string;
}

interface IdContext {
  componentPath: string;
  parentId: string;
  siblingIndex: number;
  spreadLoc: string | null;
  mapKey: string | null;
}

const cache = new Map<string, { hash: string; injections: InjectionPoint[] }>();

export default function loomIds(options: LoomIdsPluginOptions = {}): unknown {
  const attrName = options.attrName ?? "data-loom-id";
  const projectRoot = options.projectRoot ?? process.cwd();
  const useCache = options.cache !== false;

  return {
    name: "vite-plugin-loom-ids",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!/\.(tsx|jsx)$/.test(id)) return null;
      if (id.includes("node_modules")) return null;

      const contentHash = createHash("sha256").update(code).digest("hex").slice(0, 12);
      const cacheKey = id;
      if (useCache) {
        const cached = cache.get(cacheKey);
        if (cached && cached.hash === contentHash) {
          return applyInjections(code, cached.injections, attrName);
        }
      }

      let ast: Node;
      try {
        ast = parseFile(code);
      } catch {
        return null;
      }

      const rel = relative(projectRoot, id).replace(/\\/g, "/");
      const injections: InjectionPoint[] = [];
      walkJsx(ast, rel, "root", (point) => injections.push(point));

      if (useCache) {
        cache.set(cacheKey, { hash: contentHash, injections });
      }

      return applyInjections(code, injections, attrName);
    },
  };
}

function applyInjections(
  code: string,
  injections: InjectionPoint[],
  attrName: string,
): { code: string; map: ReturnType<MagicString["generateMap"]> } | null {
  if (injections.length === 0) return null;
  const s = new MagicString(code);
  // Insert after the tag name (start position is the opening element's name end)
  for (const i of injections) {
    s.appendLeft(i.start, ` ${attrName}="${i.id}"`);
  }
  return {
    code: s.toString(),
    map: s.generateMap({ hires: true }),
  };
}

function walkJsx(
  ast: Node,
  componentPath: string,
  rootId: string,
  push: (i: InjectionPoint) => void,
): void {
  walkChildren(ast as Node, { componentPath, parentId: rootId, siblingIndex: 0, spreadLoc: null, mapKey: null }, push);
}

function walkChildren(
  node: Node,
  ctx: IdContext,
  push: (i: InjectionPoint) => void,
): void {
  let siblingIdx = 0;
  walkAll(node, (n, parent) => {
    if (n.type !== "JSXOpeningElement") return;
    if (skip(n)) return;
    const componentName = openingNameToString(n.name as Node);
    const staticProps = extractStaticProps(n);
    const spreadLoc = spreadSourceLoc(n);
    const mapKey = inferMapKey(parent);
    const id = hashId({
      componentPath: ctx.componentPath,
      componentName,
      staticProps,
      spreadLoc,
      mapKey,
      parentId: ctx.parentId,
      siblingIndex: siblingIdx++,
    });
    const namePos = posOfName(n.name as Node);
    if (namePos !== null) {
      push({ start: namePos, id });
    }
  });
}

function skip(n: Node): boolean {
  // Don't re-inject if attribute already exists.
  const attrs = (n.attributes as Node[] | undefined) ?? [];
  return attrs.some((a) => {
    if (a.type !== "JSXAttribute") return false;
    const name = a.name as Node | undefined;
    return name?.type === "JSXIdentifier" && (name.name as string) === "data-loom-id";
  });
}

function openingNameToString(name: Node): string {
  if (name.type === "JSXIdentifier") return name.name as string;
  if (name.type === "JSXMemberExpression") {
    return `${openingNameToString(name.object as Node)}.${openingNameToString(name.property as Node)}`;
  }
  return name.type;
}

function posOfName(name: Node): number | null {
  const end = (name as unknown as { end?: number }).end;
  return typeof end === "number" ? end : null;
}

const LITERAL_TYPES = new Set([
  "Literal",
  "StringLiteral",
  "NumericLiteral",
  "BooleanLiteral",
  "NullLiteral",
]);

function extractStaticProps(opening: Node): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const attrs = (opening.attributes as Node[] | undefined) ?? [];
  for (const a of attrs) {
    if (a.type !== "JSXAttribute") continue;
    const name = a.name as Node | undefined;
    const value = a.value as Node | undefined;
    if (!name || !value) continue;
    const propName = name.type === "JSXIdentifier" ? (name.name as string) : "_";
    if (LITERAL_TYPES.has(value.type)) {
      out[propName] = (value as unknown as { value: unknown }).value;
    } else if (value.type === "JSXExpressionContainer") {
      const inner = (value as Node).expression as Node | undefined;
      if (inner && LITERAL_TYPES.has(inner.type)) {
        out[propName] = (inner as unknown as { value: unknown }).value;
      }
    }
  }
  const sortedKeys = Object.keys(out).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of sortedKeys) sorted[k] = out[k];
  return sorted;
}

function spreadSourceLoc(opening: Node): string | null {
  const attrs = (opening.attributes as Node[] | undefined) ?? [];
  for (const a of attrs) {
    if (a.type === "JSXSpreadAttribute") {
      const loc = a.loc?.start;
      return loc ? `L${loc.line}:C${loc.column}` : "spread";
    }
  }
  return null;
}

function inferMapKey(parent: Node | null): string | null {
  if (!parent) return null;
  // Check if this JSX element is the result of a .map() callback that returns it.
  if (parent.type !== "ArrowFunctionExpression" && parent.type !== "FunctionExpression") return null;
  // Heuristic only — we can't infer dynamic keys here, but the presence of a `key=` attribute
  // is more reliable; that is captured via staticProps already.
  return null;
}

function hashId(input: {
  componentPath: string;
  componentName: string;
  staticProps: Record<string, unknown>;
  spreadLoc: string | null;
  mapKey: string | null;
  parentId: string;
  siblingIndex: number;
}): string {
  const h = createHash("sha256");
  h.update(input.componentPath);
  h.update(":");
  h.update(input.componentName);
  h.update(":");
  h.update(JSON.stringify(input.staticProps));
  h.update(":");
  h.update(input.spreadLoc ?? "");
  h.update(":");
  h.update(input.mapKey ?? "");
  h.update(":");
  h.update(input.parentId);
  h.update(":");
  h.update(String(input.siblingIndex));
  return h.digest("hex").slice(0, 12);
}

export function injectIdsForTesting(source: string, filePath: string): string {
  const ast = parseFile(source);
  const injections: InjectionPoint[] = [];
  walkJsx(ast, filePath, "root", (i) => injections.push(i));
  if (injections.length === 0) return source;
  const s = new MagicString(source);
  for (const i of injections) s.appendLeft(i.start, ` data-loom-id="${i.id}"`);
  return s.toString();
}

export function clearLoomIdCacheForTesting(): void {
  cache.clear();
}

// Convenience: read a file and inject IDs (used by the CLI for one-off verification).
export function injectIdsFromFile(filePath: string): string {
  return injectIdsForTesting(readFileSync(filePath, "utf8"), filePath);
}
