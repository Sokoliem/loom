import { describe, expect, it } from "vitest";
import {
  clearLoomIdCacheForTesting,
  injectIdsForTesting,
} from "../src/vite-plugin-loom-ids/index.js";

describe("vite-plugin-loom-ids", () => {
  it("injects data-loom-id on simple JSX", () => {
    clearLoomIdCacheForTesting();
    const out = injectIdsForTesting(
      `export default function X() { return <div><span>hi</span></div>; }`,
      "/p/X.tsx",
    );
    expect(out).toMatch(/<div data-loom-id="[a-f0-9]{12}"/);
    expect(out).toMatch(/<span data-loom-id="[a-f0-9]{12}"/);
  });

  it("is stable: identical source → identical IDs", () => {
    clearLoomIdCacheForTesting();
    const src = `export default function X() { return <button>go</button>; }`;
    const a = injectIdsForTesting(src, "/p/X.tsx");
    const b = injectIdsForTesting(src, "/p/X.tsx");
    expect(a).toBe(b);
  });

  it("differs across file paths", () => {
    clearLoomIdCacheForTesting();
    const src = `export default function X() { return <button>go</button>; }`;
    const a = injectIdsForTesting(src, "/p/X.tsx");
    const b = injectIdsForTesting(src, "/p/Y.tsx");
    expect(a).not.toBe(b);
  });

  it("handles JSX spread (different sources produce different IDs even if static props match)", () => {
    clearLoomIdCacheForTesting();
    const a = injectIdsForTesting(
      `function X({ rest }) { return <button {...rest}>x</button>; }`,
      "/p/X.tsx",
    );
    const b = injectIdsForTesting(
      `function X({ rest }) { return (
  <button {...rest}>x</button>
); }`,
      "/p/X.tsx",
    );
    expect(a).not.toBe(b);
  });

  it("does not re-inject when data-loom-id already present", () => {
    clearLoomIdCacheForTesting();
    const src = `export default function X() { return <div data-loom-id="aaaaaaaaaaaa">x</div>; }`;
    const out = injectIdsForTesting(src, "/p/X.tsx");
    expect(out).toBe(src);
  });

  it("handles TypeScript-annotated JSX", () => {
    clearLoomIdCacheForTesting();
    const src = `import type { ReactNode } from "react";
interface Props { title: string; children: ReactNode }
export default function X({ title, children }: Props) {
  return <section><h1>{title}</h1>{children}</section>;
}`;
    const out = injectIdsForTesting(src, "/p/X.tsx");
    expect(out).toMatch(/<section data-loom-id="[a-f0-9]{12}"/);
    expect(out).toMatch(/<h1 data-loom-id="[a-f0-9]{12}"/);
  });
});
