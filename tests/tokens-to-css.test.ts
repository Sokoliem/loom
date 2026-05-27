import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import YAML from "yaml";
import { tokensToCss } from "../src/studio/tokens-to-css.js";

function setupProject(tokens: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "loom-css-test-"));
  mkdirSync(join(root, "tokens"), { recursive: true });
  for (const [namespace, tree] of Object.entries(tokens)) {
    writeFileSync(join(root, "tokens", `${namespace}.yaml`), YAML.stringify(tree));
  }
  return root;
}

describe("tokensToCss", () => {
  it("emits color tokens under :root + [data-theme='light']", () => {
    const dir = setupProject({
      color: {
        seed: { hue: 250, chroma: 0.2 },
        surface: { base: "oklch(0.98 0.01 250)" },
        text: { primary: "oklch(0.20 0.02 250)" },
      },
    });
    const css = tokensToCss(dir);
    expect(css).toContain(':root, [data-theme="light"]');
    expect(css).toContain("--surface-base: oklch(0.98 0.01 250)");
    expect(css).toContain("--text-primary: oklch(0.20 0.02 250)");
    // color.seed.* are private, must NOT be emitted
    expect(css).not.toContain("--seed-hue");
  });

  it("emits theme.dark overrides under [data-theme='dark']", () => {
    const dir = setupProject({
      color: {
        seed: { hue: 250, chroma: 0.2 },
        surface: { base: "oklch(0.98 0.01 250)" },
        text: { primary: "oklch(0.20 0.02 250)" },
      },
      theme: {
        light: { background: "{color.surface.base}" },
        dark: {
          background: "oklch(0.16 0.015 250)",
          surface: { base: "oklch(0.16 0.015 250)" },
          text: { primary: "oklch(0.95 0.01 250)" },
        },
      },
    });
    const css = tokensToCss(dir);
    expect(css).toContain('[data-theme="dark"]');
    // The dark surface.base value must override the light --surface-base
    const darkBlock = css.split('[data-theme="dark"]')[1] ?? "";
    expect(darkBlock).toContain("--surface-base: oklch(0.16 0.015 250)");
    expect(darkBlock).toContain("--text-primary: oklch(0.95 0.01 250)");
    expect(darkBlock).toContain("--background: oklch(0.16 0.015 250)");
  });

  it("emits typography under --font-*", () => {
    const dir = setupProject({
      typography: { size: { lg: "18px" }, family: { sans: "Inter, system-ui" } },
    });
    const css = tokensToCss(dir);
    expect(css).toContain("--font-size-lg: 18px");
    expect(css).toContain("--font-family-sans: Inter, system-ui");
  });

  it("dashifies underscores and dots in token names", () => {
    const dir = setupProject({
      color: { status: { success_soft: "#abc" } },
    });
    const css = tokensToCss(dir);
    expect(css).toContain("--status-success-soft: #abc");
  });

  it("returns a comment on resolution failure rather than throwing", () => {
    const dir = setupProject({ color: { a: "{color.missing}" } });
    const css = tokensToCss(dir);
    expect(css).toContain("token resolution failed");
  });
});
