import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildManifest } from "../src/core/version.js";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "loom-ver-"));
  mkdirSync(join(root, "tokens"), { recursive: true });
  mkdirSync(join(root, "routes"), { recursive: true });
  writeFileSync(join(root, "loom.yaml"), "name: test\n");
  writeFileSync(join(root, "tokens", "color.yaml"), "accent:\n  primary: '#fff'\n");
  writeFileSync(join(root, "routes", "index.tsx"), "export default () => null;\n");
  return root;
}

describe("version manifest", () => {
  it("produces the same hash for the same content", () => {
    const a = fixture();
    const b = fixture();
    expect(buildManifest(a).hash).toBe(buildManifest(b).hash);
  });

  it("changes the hash when a tracked file changes", () => {
    const dir = fixture();
    const before = buildManifest(dir).hash;
    writeFileSync(join(dir, "tokens", "color.yaml"), "accent:\n  primary: '#000'\n");
    const after = buildManifest(dir).hash;
    expect(before).not.toBe(after);
  });

  it("is stable across 3 runs on the same content", () => {
    const dir = fixture();
    const hashes = [buildManifest(dir).hash, buildManifest(dir).hash, buildManifest(dir).hash];
    expect(new Set(hashes).size).toBe(1);
  });
});
