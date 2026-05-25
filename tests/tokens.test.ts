import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import YAML from "yaml";
import { loadTokens, resolveAll, resolveValue, getToken } from "../src/core/tokens.js";

function setupProject(tokens: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "loom-test-"));
  mkdirSync(join(root, "tokens"), { recursive: true });
  for (const [namespace, tree] of Object.entries(tokens)) {
    writeFileSync(join(root, "tokens", `${namespace}.yaml`), YAML.stringify(tree));
  }
  return root;
}

describe("tokens", () => {
  it("resolves direct values", () => {
    const dir = setupProject({ color: { accent: { primary: "#abc" } } });
    expect(getToken(dir, "color.accent.primary")).toBe("#abc");
  });

  it("resolves references", () => {
    const dir = setupProject({
      color: {
        seed: { hue: 250, chroma: 0.2 },
        accent: { primary: "oklch(0.65 {color.seed.chroma} {color.seed.hue})" },
      },
    });
    const { flat } = loadTokens(dir);
    expect(resolveValue(flat.get("color.accent.primary")!, flat)).toBe("oklch(0.65 0.2 250)");
  });

  it("throws on cycles", () => {
    const dir = setupProject({
      color: { a: "{color.b}", b: "{color.a}" },
    });
    const { flat } = loadTokens(dir);
    expect(() => resolveAll(flat)).toThrow(/cycle/);
  });

  it("throws on missing references", () => {
    const dir = setupProject({ color: { a: "{color.missing}" } });
    const { flat } = loadTokens(dir);
    expect(() => resolveAll(flat)).toThrow(/not found/);
  });

  it("is deterministic — same input produces same resolved value", () => {
    const dir = setupProject({
      color: { seed: { hue: 220 }, accent: { primary: "oklch(0.5 0.1 {color.seed.hue})" } },
    });
    const a = getToken(dir, "color.accent.primary");
    const b = getToken(dir, "color.accent.primary");
    expect(a).toBe(b);
  });
});
