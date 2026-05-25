import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import YAML from "yaml";
import { runExport } from "../src/export/index.js";

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "loom-exp-"));
  mkdirSync(join(root, "tokens"), { recursive: true });
  mkdirSync(join(root, "components", "Button"), { recursive: true });
  mkdirSync(join(root, "routes"), { recursive: true });
  writeFileSync(
    join(root, "tokens", "color.yaml"),
    YAML.stringify({ accent: { primary: "oklch(0.65 0.2 250)" } }),
  );
  writeFileSync(
    join(root, "tokens", "spacing.yaml"),
    YAML.stringify({ "1": "4px", "2": "8px" }),
  );
  writeFileSync(join(root, "loom.yaml"), "name: t\n");
  writeFileSync(
    join(root, "components", "Button", "Button.tsx"),
    `export const Button = () => <button>x</button>;`,
  );
  writeFileSync(
    join(root, "components", "Button", "Button.stories.mdx"),
    `import { Button } from "./Button";\n<Button />\n`,
  );
  writeFileSync(join(root, "routes", "index.tsx"), `export default () => <main>home</main>;`);
  return root;
}

describe("exports", () => {
  it("emits css-vars deterministically", () => {
    const dir = project();
    const a = runExport(dir, "css-vars", join(dir, "exports", "a"));
    const b = runExport(dir, "css-vars", join(dir, "exports", "b"));
    expect(readFileSync(a.files[0]!, "utf8")).toBe(readFileSync(b.files[0]!, "utf8"));
  });

  it("emits tailwind config with token-derived colors", () => {
    const dir = project();
    const r = runExport(dir, "tailwind", join(dir, "exports", "tw"));
    const text = readFileSync(r.files[0]!, "utf8");
    expect(text).toMatch(/colors/);
  });

  it("emits a react-shadcn project with package.json + tsconfig + vite + components", () => {
    const dir = project();
    const r = runExport(dir, "react-shadcn", join(dir, "exports", "rs"));
    expect(existsSync(join(r.outDir, "package.json"))).toBe(true);
    expect(existsSync(join(r.outDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(r.outDir, "vite.config.ts"))).toBe(true);
    expect(existsSync(join(r.outDir, "components", "Button", "Button.tsx"))).toBe(true);
    expect(existsSync(join(r.outDir, "routes", "index.tsx"))).toBe(true);
  });

  it("emits a route-map markdown", () => {
    const dir = project();
    const r = runExport(dir, "route-map-md", join(dir, "exports", "rm"));
    const text = readFileSync(r.files[0]!, "utf8");
    expect(text).toMatch(/Route map/);
  });
});
