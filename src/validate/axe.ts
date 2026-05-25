import type { LintFinding } from "./lints.js";

export interface AxeOptions {
  url?: string;
  html?: string;
  tags?: string[];
}

export interface AxeResult {
  available: boolean;
  reason?: string;
  findings: LintFinding[];
}

/** Optional axe-core integration. Requires `playwright` + `axe-core` at runtime. */
export async function runAxe(opts: AxeOptions): Promise<AxeResult> {
  if (!opts.url && !opts.html) {
    return { available: false, reason: "no url or html provided", findings: [] };
  }

  let playwright: typeof import("playwright") | null = null;
  try {
    playwright = await import("playwright");
  } catch {
    return {
      available: false,
      reason: "playwright not installed — run `pnpm add playwright && pnpm exec playwright install chromium`",
      findings: [],
    };
  }

  let axeSource = "";
  try {
    const axeModule = (await import("axe-core")) as { source?: string };
    axeSource = axeModule.source ?? "";
  } catch {
    return {
      available: false,
      reason: "axe-core not installed — run `pnpm add axe-core`",
      findings: [],
    };
  }
  if (!axeSource) {
    return { available: false, reason: "axe-core present but missing .source", findings: [] };
  }

  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    if (opts.url) {
      await page.goto(opts.url, { waitUntil: "networkidle", timeout: 30000 });
    } else if (opts.html) {
      await page.setContent(opts.html, { waitUntil: "networkidle", timeout: 30000 });
    }
    await page.addScriptTag({ content: axeSource });
    const result = (await page.evaluate(async (tags) => {
      const w = globalThis as unknown as {
        axe: { run: (opts: unknown) => Promise<{ violations: unknown[] }> };
      };
      return w.axe.run({ runOnly: { type: "tag", values: tags } });
    }, opts.tags ?? ["wcag2a", "wcag2aa"])) as { violations: AxeViolation[] };

    const findings: LintFinding[] = [];
    for (const v of result.violations) {
      for (const n of v.nodes) {
        findings.push({
          rule: `axe:${v.id}`,
          severity: v.impact === "critical" || v.impact === "serious" ? "error" : "warn",
          file: opts.url ?? "(inline)",
          line: 0,
          column: 0,
          message: `${v.help} (impact: ${v.impact ?? "minor"})`,
          hint: n.failureSummary ?? v.helpUrl,
        });
      }
    }
    return { available: true, findings };
  } finally {
    await browser.close();
  }
}

interface AxeViolation {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  help: string;
  helpUrl: string;
  nodes: Array<{ failureSummary?: string }>;
}
