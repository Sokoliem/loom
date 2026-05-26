import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

let testDir: string;

vi.mock("./paths.js", async () => {
  const actual = await vi.importActual<typeof import("./paths.js")>("./paths.js");
  return {
    ...actual,
    serverDbPath: () => process.env.LOOM_TEST_DB_PATH ?? actual.serverDbPath(),
  };
});

beforeAll(() => {
  testDir = mkdtempSync(join(tmpdir(), "loom-activity-"));
  process.env.LOOM_TEST_DB_PATH = join(testDir, "server.sqlite");
});

afterAll(async () => {
  const { _closeServerForTests } = await import("./project.js");
  _closeServerForTests();
  delete process.env.LOOM_TEST_DB_PATH;
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Windows occasionally holds the file briefly after close; harmless.
  }
});

function pid(): string {
  return `p_${randomBytes(8).toString("hex")}`;
}

describe("activity store", () => {
  it("inserts and lists events newest-first", async () => {
    const { activityInsert, activityList } = await import("./activity.js");
    const p = pid();
    const a = activityInsert({ projectId: p, kind: "file", title: "first", createdAt: 100 });
    const b = activityInsert({ projectId: p, kind: "file", title: "second", createdAt: 200 });
    const c = activityInsert({ projectId: p, kind: "file", title: "third", createdAt: 300 });

    const events = activityList(p);
    expect(events.map((e) => e.id)).toEqual([c.id, b.id, a.id]);
    expect(events[0]?.title).toBe("third");
  });

  it("scopes list results to the requested project", async () => {
    const { activityInsert, activityList } = await import("./activity.js");
    const p1 = pid();
    const p2 = pid();
    activityInsert({ projectId: p1, kind: "file", title: "p1-event" });
    activityInsert({ projectId: p2, kind: "file", title: "p2-event" });

    expect(activityList(p1).map((e) => e.title)).toEqual(["p1-event"]);
    expect(activityList(p2).map((e) => e.title)).toEqual(["p2-event"]);
  });

  it("filters by kinds when provided", async () => {
    const { activityInsert, activityList } = await import("./activity.js");
    const p = pid();
    activityInsert({ projectId: p, kind: "file", title: "file-1", createdAt: 1 });
    activityInsert({ projectId: p, kind: "forge", title: "forge-1", createdAt: 2 });
    activityInsert({ projectId: p, kind: "panel", title: "panel-1", createdAt: 3 });

    const onlyFile = activityList(p, { kinds: ["file"] });
    expect(onlyFile.map((e) => e.title)).toEqual(["file-1"]);

    const fileAndForge = activityList(p, { kinds: ["file", "forge"] });
    expect(fileAndForge.map((e) => e.title).sort()).toEqual(["file-1", "forge-1"]);
  });

  it("respects the limit (clamped to 1..500)", async () => {
    const { activityInsert, activityList } = await import("./activity.js");
    const p = pid();
    for (let i = 0; i < 10; i += 1) {
      activityInsert({ projectId: p, kind: "file", title: `t${i}`, createdAt: i });
    }
    expect(activityList(p, { limit: 3 })).toHaveLength(3);
    expect(activityList(p, { limit: 0 })).toHaveLength(1); // clamped to min 1
    expect(activityList(p, { limit: 9999 })).toHaveLength(10); // capped to inserted count
  });

  it("trims to MAX_PER_PROJECT and keeps the newest", async () => {
    const { activityInsert, activityList, activityTrim } = await import("./activity.js");
    const p = pid();
    for (let i = 0; i < 25; i += 1) {
      activityInsert({ projectId: p, kind: "file", title: `t${i}`, createdAt: i });
    }
    const removed = activityTrim(p, 10);
    expect(removed).toBe(15);

    const remaining = activityList(p, { limit: 100 });
    expect(remaining).toHaveLength(10);
    expect(remaining[0]?.title).toBe("t24");
    expect(remaining[9]?.title).toBe("t15");
  });

  it("round-trips payload JSON", async () => {
    const { activityInsert, activityList } = await import("./activity.js");
    const p = pid();
    activityInsert({
      projectId: p,
      kind: "version",
      subkind: "restored",
      title: "Restored v123",
      refId: "v123",
      payload: { route: "/", priorVersion: "v122" },
    });
    const [event] = activityList(p);
    expect(event?.payload).toEqual({ route: "/", priorVersion: "v122" });
    expect(event?.subkind).toBe("restored");
    expect(event?.refId).toBe("v123");
  });

  it("emits on the bus for the global listener", async () => {
    const { activityBus, activityInsert } = await import("./activity.js");
    const seen: string[] = [];
    const handler = (e: { title: string }): void => {
      seen.push(e.title);
    };
    activityBus.on("event", handler);
    activityInsert({ projectId: pid(), kind: "file", title: "bus-test" });
    activityBus.off("event", handler);
    expect(seen).toContain("bus-test");
  });

  it("emits on the per-project bus channel", async () => {
    const { activityBus, activityInsert } = await import("./activity.js");
    const p1 = pid();
    const p2 = pid();
    const seen: string[] = [];
    const handler = (e: { title: string }): void => {
      seen.push(e.title);
    };
    activityBus.on(`event:${p1}`, handler);
    activityInsert({ projectId: p1, kind: "file", title: "p1-only" });
    activityInsert({ projectId: p2, kind: "file", title: "p2-event" });
    activityBus.off(`event:${p1}`, handler);
    expect(seen).toEqual(["p1-only"]);
  });
});
