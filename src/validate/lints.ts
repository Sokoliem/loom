import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { componentsDir, routesDir } from "../core/paths.js";
import { loadTokens, resolveAll } from "../core/tokens.js";
import { parseFile, walkAll, type Node } from "./ast-utils.js";

export interface LintFinding {
  rule: string;
  severity: "info" | "warn" | "error";
  file: string;
  line: number;
  column: number;
  message: string;
  hint?: string;
}

const COLOR_LITERAL_RE = /(#[0-9a-fA-F]{3,8})|\b(rgb|rgba|hsl|hsla|oklch|oklab|color)\s*\(/;
const TOKEN_VAR_RE = /var\(\s*--[a-z][a-z0-9-]*/i;
const IGNORE_NEXT = /\/\/\s*loom-ignore-next-line/;

export interface LintScope {
  projectDir: string;
  files?: string[];
}

export function tokenUsageLint(scope: LintScope): LintFinding[] {
  const tokens = loadTokens(scope.projectDir);
  const resolved = (() => {
    try {
      return resolveAll(tokens.flat);
    } catch {
      return new Map<string, string>();
    }
  })();
  const allowed = new Set<string>(resolved.values());

  const findings: LintFinding[] = [];
  for (const file of collectSources(scope)) {
    const source = readFileSync(file, "utf8");
    const ignored = ignoredLines(source);
    const rel = relative(scope.projectDir, file).split(sep).join("/");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (ignored.has(idx + 1)) return;
      if (TOKEN_VAR_RE.test(line)) return;
      const m = line.match(COLOR_LITERAL_RE);
      if (!m || m.index === undefined) return;
      const matched = m[0];
      if (allowed.has(matched.trim())) return;
      findings.push({
        rule: "token-usage",
        severity: "warn",
        file: rel,
        line: idx + 1,
        column: m.index + 1,
        message: `raw color literal '${matched}' is not defined as a token`,
        hint: "define it in tokens/color.yaml and reference via var(--…) or {namespace.path}",
      });
    });
  }
  return findings;
}

export function deterministicSourceLint(scope: LintScope): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const file of collectSources(scope)) {
    const source = readFileSync(file, "utf8");
    const rel = relative(scope.projectDir, file).split(sep).join("/");
    let ast: Node;
    try {
      ast = parseFile(source);
    } catch {
      continue;
    }
    walkAll(ast, (node) => {
      if (node.type !== "CallExpression") return;
      const callee = node.callee as Node | undefined;
      const flagged = nameOfCallee(callee);
      if (!flagged) return;
      const loc = node.loc?.start;
      if (!loc) return;
      findings.push({
        rule: "deterministic-source",
        severity: "warn",
        file: rel,
        line: loc.line,
        column: loc.column + 1,
        message: `non-deterministic source '${flagged}' used in component file`,
        hint: "pass a seedable equivalent through props or use a deterministic helper",
      });
    });
  }
  return findings;
}

function nameOfCallee(callee: Node | undefined): string | null {
  if (!callee) return null;
  if (callee.type === "MemberExpression") {
    const obj = callee.object as Node | undefined;
    const prop = callee.property as Node | undefined;
    const objName = obj?.type === "Identifier" ? (obj.name as string) : null;
    const propName = prop?.type === "Identifier" ? (prop.name as string) : null;
    if (objName === "Date" && propName === "now") return "Date.now";
    if (objName === "Math" && propName === "random") return "Math.random";
    if (objName === "crypto" && propName === "randomUUID") return "crypto.randomUUID";
    if (objName === "performance" && propName === "now") return "performance.now";
  }
  return null;
}

function ignoredLines(source: string): Set<number> {
  const out = new Set<number>();
  source.split(/\r?\n/).forEach((line, idx) => {
    if (IGNORE_NEXT.test(line)) out.add(idx + 2);
  });
  return out;
}

function collectSources(scope: LintScope): string[] {
  if (scope.files) return scope.files;
  const files: string[] = [];
  const roots = [componentsDir(scope.projectDir), routesDir(scope.projectDir)];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    walk(root, (file) => {
      if (file.endsWith(".tsx") || file.endsWith(".jsx") || file.endsWith(".ts")) {
        files.push(file);
      }
    });
  }
  return files;
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
