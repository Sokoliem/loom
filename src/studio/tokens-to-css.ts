import { loadTokens, resolveAll } from "../core/tokens.js";

/**
 * Build a CSS string with `--token-name: value;` declarations grouped by theme.
 *
 * Conventions used by the scaffolded primitives:
 *   - `color.accent.primary`         → --accent-primary           (strip the `color.` namespace)
 *   - `color.surface.card`           → --surface-card
 *   - `color.text.primary`           → --text-primary
 *   - `color.status.success_soft`    → --status-success-soft      (underscores → dashes)
 *   - `typography.family.sans`       → --font-family-sans         (typography → font prefix)
 *   - `typography.size.lg`           → --font-size-lg
 *   - `spacing.8`                    → --spacing-8
 *   - `radius.md`                    → --radius-md
 *   - `motion.duration.fast`         → --motion-duration-fast
 *
 *   - `color.seed.*`                 → skipped (private references)
 *   - `color.light.*` + `theme.light.*` → emitted under `:root`
 *   - `color.dark.*`  + `theme.dark.*`  → emitted under `[data-theme="dark"]`
 */
export function tokensToCss(projectDir: string): string {
  const { flat } = loadTokens(projectDir);
  let resolved: Map<string, string>;
  try {
    resolved = resolveAll(flat);
  } catch (err) {
    return `/* loom: token resolution failed — ${(err as Error).message} */\n`;
  }

  const root: string[] = [];
  const lightOverlay: string[] = [];
  const darkOverlay: string[] = [];

  for (const [key, value] of resolved) {
    const cssVar = toCssVar(key);
    if (cssVar === null) continue;
    const decl = `  ${cssVar.name}: ${value};`;
    if (cssVar.theme === "light") lightOverlay.push(decl);
    else if (cssVar.theme === "dark") darkOverlay.push(decl);
    else root.push(decl);
  }

  const blocks: string[] = [];
  if (root.length || lightOverlay.length) {
    blocks.push(`:root, [data-theme="light"] {\n${[...root, ...lightOverlay].join("\n")}\n}`);
  }
  if (darkOverlay.length) {
    blocks.push(`[data-theme="dark"] {\n${darkOverlay.join("\n")}\n}`);
  }
  return blocks.join("\n\n") + "\n";
}

interface CssVar {
  name: string;
  theme?: "light" | "dark";
}

function toCssVar(key: string): CssVar | null {
  const segs = key.split(".");
  if (segs.length === 0) return null;
  const [ns, ...rest] = segs;
  if (!ns || rest.length === 0) return null;

  if (ns === "color" || ns === "theme") {
    const [maybeTheme, ...inner] = rest;
    if (maybeTheme === "light" || maybeTheme === "dark") {
      if (inner.length === 0) return null;
      return { name: `--${dashify(inner.join("-"))}`, theme: maybeTheme as "light" | "dark" };
    }
    if (ns === "color" && rest[0] === "seed") return null;
    return { name: `--${dashify(rest.join("-"))}` };
  }

  if (ns === "typography") {
    const [kind, ...inner] = rest;
    if (!kind) return null;
    return { name: `--font-${dashify([kind, ...inner].join("-"))}` };
  }

  return { name: `--${dashify([ns, ...rest].join("-"))}` };
}

function dashify(s: string): string {
  return s.replace(/[_.]/g, "-");
}
