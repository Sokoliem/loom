import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startWatcher, type WatchEvent, type WatcherHandle } from "../src/core/watcher.js";

function setupProject(): string {
  const root = mkdtempSync(join(tmpdir(), "loom-watch-test-"));
  mkdirSync(join(root, "routes"), { recursive: true });
  mkdirSync(join(root, "components"), { recursive: true });
  mkdirSync(join(root, "tokens"), { recursive: true });
  writeFileSync(join(root, "loom.yaml"), "name: watcher-test\n");
  writeFileSync(join(root, "routes", "index.tsx"), "export default function I(){return null}\n");
  return root;
}

function wait(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

describe("watcher route events", () => {
  let handle: WatcherHandle | null = null;
  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = null;
    }
  });

  it("fires route_changed when a new .tsx is added under routes/", async () => {
    const root = setupProject();
    const events: WatchEvent[] = [];
    handle = startWatcher(root, (e) => events.push(e));
    await wait(150); // let chokidar settle
    writeFileSync(join(root, "routes", "foo.tsx"), "export default function F(){return null}\n");
    await wait(400); // awaitWriteFinish + debounce
    const routeEvents = events.filter(
      (e) => e.kind === "route_changed" && /[\\/]routes[\\/]foo\.tsx$/.test((e as { path: string }).path),
    );
    expect(routeEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("fires route_changed for component .tsx adds", async () => {
    const root = setupProject();
    const events: WatchEvent[] = [];
    handle = startWatcher(root, (e) => events.push(e));
    await wait(150);
    mkdirSync(join(root, "components", "Card"), { recursive: true });
    writeFileSync(join(root, "components", "Card", "Card.tsx"), "export const Card = () => null;\n");
    await wait(400);
    const componentEvents = events.filter(
      (e) => e.kind === "route_changed" && /[\\/]components[\\/]Card[\\/]Card\.tsx$/.test((e as { path: string }).path),
    );
    expect(componentEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("fires route_changed on unlink (route removal)", async () => {
    const root = setupProject();
    writeFileSync(join(root, "routes", "doomed.tsx"), "export default function D(){return null}\n");
    await wait(100);
    const events: WatchEvent[] = [];
    handle = startWatcher(root, (e) => events.push(e));
    await wait(150);
    unlinkSync(join(root, "routes", "doomed.tsx"));
    await wait(400);
    const unlinks = events.filter(
      (e) => e.kind === "route_changed" && /[\\/]doomed\.tsx$/.test((e as { path: string }).path),
    );
    expect(unlinks.length).toBeGreaterThanOrEqual(1);
  });
});
