import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import YAML from "yaml";
import { setToken, loadTokens } from "../src/core/tokens.js";

function setupProject(tokens: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "loom-patch-test-"));
  mkdirSync(join(root, "tokens"), { recursive: true });
  for (const [namespace, tree] of Object.entries(tokens)) {
    writeFileSync(join(root, "tokens", `${namespace}.yaml`), YAML.stringify(tree));
  }
  return root;
}

describe("setToken (PATCH backend)", () => {
  it("writes a scalar value and round-trips through loadTokens", () => {
    const dir = setupProject({
      color: { seed: { hue: 250 }, accent: { primary: "oklch(0.6 0.2 250)" } },
    });
    setToken(dir, "color.accent.primary", "oklch(0.7 0.18 30)");
    const { flat } = loadTokens(dir);
    expect(flat.get("color.accent.primary")).toBe("oklch(0.7 0.18 30)");
  });

  it("preserves siblings under the same namespace", () => {
    const dir = setupProject({
      color: { accent: { primary: "#abc", muted: "#def" } },
    });
    setToken(dir, "color.accent.primary", "#123");
    const written = YAML.parse(readFileSync(join(dir, "tokens", "color.yaml"), "utf8"));
    expect(written.accent.muted).toBe("#def");
    expect(written.accent.primary).toBe("#123");
  });

  it("rejects updates that would introduce a cycle", () => {
    const dir = setupProject({
      color: { a: "#fff", b: "{color.a}" },
    });
    expect(() => setToken(dir, "color.a", "{color.b}")).toThrow(/cycle/);
    // Disk state should remain valid (the cycle was rejected pre-write).
    const written = YAML.parse(readFileSync(join(dir, "tokens", "color.yaml"), "utf8"));
    expect(written.a).toBe("#fff");
  });

  it("rejects unqualified refs (single segment)", () => {
    const dir = setupProject({ color: { a: "#abc" } });
    expect(() => setToken(dir, "bareKey", "#000")).toThrow(/invalid token reference/);
  });

  it("creates new namespaces on the fly", () => {
    const dir = setupProject({ color: { a: "#abc" } });
    setToken(dir, "spacing.4", "16px");
    const written = YAML.parse(readFileSync(join(dir, "tokens", "spacing.yaml"), "utf8"));
    expect(written[4]).toBe("16px");
  });

  it("rejects path-traversal in the namespace segment", () => {
    const dir = setupProject({ color: { a: "#abc" } });
    expect(() => setToken(dir, "../../etc/passwd.x", "pwned")).toThrow(/invalid token reference/);
    expect(() => setToken(dir, "..\\evil.x", "pwned")).toThrow(/invalid token reference/);
  });

  it("rejects path-traversal in inner segments", () => {
    const dir = setupProject({ color: { a: "#abc" } });
    expect(() => setToken(dir, "color.../foo", "pwned")).toThrow(/invalid token reference/);
    // Slashes anywhere break the safe-segment regex.
    expect(() => setToken(dir, "color./../foo", "pwned")).toThrow(/invalid token reference/);
  });

  it("rejects null-byte / control chars in segments", () => {
    const dir = setupProject({ color: { a: "#abc" } });
    expect(() => setToken(dir, "color.a\x00", "x")).toThrow(/invalid token reference/);
  });
});
