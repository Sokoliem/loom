import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import YAML from "yaml";
import { deterministicSourceLint, tokenUsageLint } from "../src/validate/lints.js";

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "loom-lint-"));
  mkdirSync(join(root, "components", "X"), { recursive: true });
  mkdirSync(join(root, "tokens"), { recursive: true });
  writeFileSync(
    join(root, "tokens", "color.yaml"),
    YAML.stringify({ accent: { primary: "oklch(0.65 0.2 250)" } }),
  );
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

describe("lints", () => {
  it("flags raw color literals", () => {
    const dir = project({
      "components/X/X.tsx": `export const X = () => <div style={{ color: "#ff0000" }} />;`,
    });
    const findings = tokenUsageLint({ projectDir: dir });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.rule).toBe("token-usage");
  });

  it("ignores literals when var(--…) is used", () => {
    const dir = project({
      "components/X/X.tsx": `export const X = () => <div style={{ color: "var(--accent-primary)" }} />;`,
    });
    expect(tokenUsageLint({ projectDir: dir })).toEqual([]);
  });

  it("flags Date.now in component files", () => {
    const dir = project({
      "components/X/X.tsx": `export const X = () => { const t = Date.now(); return <div>{t}</div>; };`,
    });
    const findings = deterministicSourceLint({ projectDir: dir });
    expect(findings.some((f) => f.message.includes("Date.now"))).toBe(true);
  });

  it("respects loom-ignore-next-line", () => {
    const dir = project({
      "components/X/X.tsx": `// loom-ignore-next-line
export const X = () => <div style={{ color: "#ff0000" }} />;`,
    });
    expect(tokenUsageLint({ projectDir: dir })).toEqual([]);
  });
});
