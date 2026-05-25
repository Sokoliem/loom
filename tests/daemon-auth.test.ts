import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon, type DaemonHandle } from "../src/daemon.js";

let h: DaemonHandle;
let secret = "";

beforeAll(async () => {
  process.env.LOOM_HOME = mkdtempSync(join(tmpdir(), "loom-daemon-"));
  process.env.LOOM_PORT = "0";
  h = await startDaemon({ port: 5390 });
  secret = readFileSync(join(process.env.LOOM_HOME, "server", "secret"), "utf8").trim();
});

afterAll(async () => {
  if (h) await h.stop();
});

describe("daemon auth", () => {
  it("/healthz is open", async () => {
    const r = await fetch(`${h.url}/api/loom/healthz`);
    expect(r.status).toBe(200);
  });

  it("POST /api/loom/watch without secret returns 401", async () => {
    const r = await fetch(`${h.url}/api/loom/watch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "/nowhere" }),
    });
    expect(r.status).toBe(401);
  });

  it("POST /api/loom/watch with bad secret returns 401", async () => {
    const r = await fetch(`${h.url}/api/loom/watch`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-loom-secret": "wrong" },
      body: JSON.stringify({ path: "/nowhere" }),
    });
    expect(r.status).toBe(401);
  });

  it("POST /api/loom/watch with secret + unknown path returns 403", async () => {
    const r = await fetch(`${h.url}/api/loom/watch`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-loom-secret": secret },
      body: JSON.stringify({ path: "/never-registered-as-a-project" }),
    });
    expect([400, 403]).toContain(r.status);
  });
});
