import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loomCacheDir } from "./paths.js";

export interface CanvasView {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasState {
  positions: Record<string, { x: number; y: number }>;
  view: CanvasView;
}

const DEFAULT: CanvasState = {
  positions: {},
  view: { x: 0, y: 0, scale: 0.25 },
};

function canvasPath(projectDir: string): string {
  return join(loomCacheDir(projectDir), "canvas.json");
}

export function readCanvas(projectDir: string): CanvasState {
  const file = canvasPath(projectDir);
  if (!existsSync(file)) return { positions: {}, view: { ...DEFAULT.view } };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<CanvasState>;
    return normalize(parsed);
  } catch {
    return { positions: {}, view: { ...DEFAULT.view } };
  }
}

export function writeCanvas(projectDir: string, state: CanvasState): void {
  const dir = loomCacheDir(projectDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const normalized = normalize(state);
  writeFileSync(canvasPath(projectDir), JSON.stringify(normalized, null, 2));
}

export function normalize(input: Partial<CanvasState> | unknown): CanvasState {
  const obj = (input as Partial<CanvasState>) ?? {};
  const positions: Record<string, { x: number; y: number }> = {};
  if (obj.positions && typeof obj.positions === "object") {
    for (const [k, v] of Object.entries(obj.positions)) {
      const pos = v as { x?: unknown; y?: unknown };
      if (
        typeof pos?.x === "number" &&
        typeof pos?.y === "number" &&
        Number.isFinite(pos.x) &&
        Number.isFinite(pos.y)
      ) {
        positions[k] = { x: pos.x, y: pos.y };
      }
    }
  }
  const view = obj.view ?? DEFAULT.view;
  return {
    positions,
    view: {
      x: numberOr(view.x, 0),
      y: numberOr(view.y, 0),
      scale: clampScale(numberOr(view.scale, 0.25)),
    },
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampScale(value: number): number {
  return Math.max(0.05, Math.min(4, value));
}
