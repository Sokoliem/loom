import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { versionSnapshot, versionRestore } from "../src/core/version.js";

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "loom-restore-"));
  mkdirSync(join(root, "tokens"), { recursive: true });
  mkdirSync(join(root, "routes"), { recursive: true });
  mkdirSync(join(root, ".loom"), { recursive: true });
  writeFileSync(join(root, "loom.yaml"), "name: rt\n");
  writeFileSync(join(root, "tokens", "color.yaml"), "accent:\n  primary: '#fff'\n");
  writeFileSync(join(root, "routes", "index.tsx"), "export default () => null;\n");
  return root;
}

describe("version restore", () => {
  it("snapshot persists blobs and safe-mode stages them under .loom/restore/", () => {
    const dir = project();
    const v = versionSnapshot(dir, "main");
    writeFileSync(join(dir, "routes", "index.tsx"), "export default () => <main>changed</main>;\n");
    versionSnapshot(dir, "main");
    const result = versionRestore(dir, v.id, "safe");
    expect(result.mode).toBe("safe");
    expect(result.restored).toBeGreaterThan(0);
    const stagedRoute = readFileSync(
      join(dir, ".loom", "restore", v.id, "routes", "index.tsx"),
      "utf8",
    );
    expect(stagedRoute).toBe("export default () => null;\n");
  });

  it("force-mode overwrites the working tree", () => {
    const dir = project();
    const v = versionSnapshot(dir, "main");
    writeFileSync(join(dir, "routes", "index.tsx"), "changed\n");
    versionSnapshot(dir, "main");
    versionRestore(dir, v.id, "force");
    expect(readFileSync(join(dir, "routes", "index.tsx"), "utf8")).toBe(
      "export default () => null;\n",
    );
  });
});
