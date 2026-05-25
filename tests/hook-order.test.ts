import { describe, expect, it } from "vitest";
import { diffHookOrder, extractHookSequence } from "../src/validate/hook-order.js";

describe("hook-order detector", () => {
  it("extracts the hook sequence from a TSX component", () => {
    const seq = extractHookSequence(
      `import { useState, useEffect } from "react";
       export default function X() {
         const [a, sa] = useState(0);
         useEffect(() => {}, []);
         return null;
       }`,
    );
    expect(seq).toEqual(["useState", "useEffect"]);
  });

  it("returns null when the sequence is identical", () => {
    const src = `export default () => { const [a] = useState(0); return null; };`;
    expect(diffHookOrder(src, src)).toBeNull();
  });

  it("returns a warning when hook count changes", () => {
    const before = `export default () => { const [a] = useState(0); return null; };`;
    const after = `export default () => {
      const [a] = useState(0);
      useEffect(() => {}, []);
      return null;
    };`;
    const w = diffHookOrder(before, after);
    expect(w).not.toBeNull();
    expect(w!.message).toMatch(/count changed/);
  });

  it("returns a warning when hook order changes", () => {
    const before = `export default () => {
      const [a] = useState(0);
      useEffect(() => {}, []);
      return null;
    };`;
    const after = `export default () => {
      useEffect(() => {}, []);
      const [a] = useState(0);
      return null;
    };`;
    const w = diffHookOrder(before, after);
    expect(w).not.toBeNull();
    expect(w!.message).toMatch(/order changed/);
  });
});
