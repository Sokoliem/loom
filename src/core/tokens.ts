import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { E } from "./errors.js";
import { tokensDir } from "./paths.js";

export type TokenTree = Record<string, unknown>;

const REF_RE = /\{([a-zA-Z_][\w.]*)\}/g;

export interface TokenLoadResult {
  trees: Record<string, TokenTree>;
  flat: Map<string, string>;
}

export function loadTokens(projectDir: string): TokenLoadResult {
  const dir = tokensDir(projectDir);
  const trees: Record<string, TokenTree> = {};
  const flat = new Map<string, string>();
  if (!existsSync(dir)) {
    return { trees, flat };
  }
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    const namespace = file.replace(/\.ya?ml$/, "");
    const raw = readFileSync(join(dir, file), "utf8");
    const parsed = (YAML.parse(raw) ?? {}) as TokenTree;
    trees[namespace] = parsed;
    flattenInto(flat, parsed, namespace);
  }
  return { trees, flat };
}

function flattenInto(out: Map<string, string>, node: unknown, prefix: string): void {
  if (node === null || node === undefined) return;
  if (typeof node !== "object") {
    out.set(prefix, String(node));
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    flattenInto(out, value, prefix ? `${prefix}.${key}` : key);
  }
}

/** Resolve a single reference string against the loaded flat token map. Pure. */
export function resolveValue(
  raw: string,
  flat: Map<string, string>,
  visiting: Set<string> = new Set(),
  path: string[] = [],
): string {
  return raw.replace(REF_RE, (_, ref: string) => {
    if (visiting.has(ref)) {
      throw E.cycle([...path, ref]);
    }
    const target = flat.get(ref);
    if (target === undefined) {
      throw E.notFound("token", ref);
    }
    visiting.add(ref);
    try {
      return resolveValue(target, flat, visiting, [...path, ref]);
    } finally {
      visiting.delete(ref);
    }
  });
}

/** Resolve every token in the flat map; throws on cycle or missing reference. */
export function resolveAll(flat: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, raw] of flat) {
    out.set(key, resolveValue(raw, flat, new Set([key]), [key]));
  }
  return out;
}

export function getToken(projectDir: string, ref: string): string {
  const { flat } = loadTokens(projectDir);
  const raw = flat.get(ref);
  if (raw === undefined) throw E.notFound("token", ref);
  return resolveValue(raw, flat, new Set([ref]), [ref]);
}

export function listTokens(projectDir: string, namespace?: string): Record<string, string> {
  const { flat } = loadTokens(projectDir);
  const out: Record<string, string> = {};
  for (const [k, v] of flat) {
    if (namespace && !k.startsWith(`${namespace}.`)) continue;
    out[k] = v;
  }
  return out;
}

export function setToken(projectDir: string, ref: string, value: string): void {
  const segs = ref.split(".");
  if (segs.length < 2) {
    throw E.invalid("token reference", "use namespace.path form (e.g., color.accent.primary)");
  }
  const namespace = segs[0]!;
  const path = segs.slice(1);
  const dir = tokensDir(projectDir);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${namespace}.yaml`);
  const tree: TokenTree = existsSync(file)
    ? ((YAML.parse(readFileSync(file, "utf8")) ?? {}) as TokenTree)
    : {};
  setDeep(tree, path, parseLiteral(value));

  // Validate against the proposed state BEFORE persisting. Build a flat map that overlays
  // the existing on-disk state with the change, resolve it, and only write on success.
  const { flat } = loadTokens(projectDir);
  flat.set(ref, String(parseLiteral(value)));
  resolveAll(flat);

  writeFileSync(file, YAML.stringify(tree));
}

function setDeep(tree: TokenTree, path: string[], value: unknown): void {
  let cur: TokenTree = tree;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const next = cur[key];
    if (next === undefined || typeof next !== "object" || next === null) {
      cur[key] = {};
    }
    cur = cur[key] as TokenTree;
  }
  cur[path[path.length - 1]!] = value;
}

function parseLiteral(value: string): unknown {
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d*\.\d+$/.test(value)) return Number.parseFloat(value);
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}
