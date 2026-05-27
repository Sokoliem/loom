import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { normalize, readCanvas, writeCanvas } from "../src/core/canvas.js";

function setup(): string {
  return mkdtempSync(join(tmpdir(), "loom-canvas-test-"));
}

describe("canvas state persistence", () => {
  it("returns defaults when no file exists", () => {
    const dir = setup();
    const state = readCanvas(dir);
    expect(state.positions).toEqual({});
    expect(state.view).toEqual({ x: 0, y: 0, scale: 0.25 });
  });

  it("round-trips through write + read", () => {
    const dir = setup();
    writeCanvas(dir, {
      positions: { "/": { x: 0, y: 0 }, "/foo": { x: 1280, y: 0 } },
      view: { x: -100, y: 50, scale: 0.5 },
    });
    const state = readCanvas(dir);
    expect(state.positions["/foo"]).toEqual({ x: 1280, y: 0 });
    expect(state.view.scale).toBe(0.5);
  });

  it("normalize() drops non-numeric positions and clamps scale", () => {
    const state = normalize({
      positions: {
        "/good": { x: 10, y: 20 },
        "/bad-x": { x: "abc", y: 0 },
        "/bad-y": { x: 0, y: NaN },
      },
      view: { x: 0, y: 0, scale: 99 },
    } as unknown);
    expect(state.positions["/good"]).toEqual({ x: 10, y: 20 });
    expect(state.positions["/bad-x"]).toBeUndefined();
    expect(state.positions["/bad-y"]).toBeUndefined();
    expect(state.view.scale).toBe(4);
  });

  it("clamps tiny scale to a minimum", () => {
    const state = normalize({ view: { x: 0, y: 0, scale: 0.0001 } });
    expect(state.view.scale).toBe(0.05);
  });

  it("tolerates a corrupted canvas.json on disk", () => {
    const dir = setup();
    mkdirSync(join(dir, ".loom"), { recursive: true });
    writeFileSync(join(dir, ".loom", "canvas.json"), "{not valid json");
    const state = readCanvas(dir);
    expect(state.positions).toEqual({});
    expect(state.view).toEqual({ x: 0, y: 0, scale: 0.25 });
  });
});
