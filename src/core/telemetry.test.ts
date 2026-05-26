import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _setTelemetryPathForTests, emit } from "./telemetry.js";

let testDir: string;
let logPath: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "loom-tel-"));
  logPath = join(testDir, "telemetry.jsonl");
  _setTelemetryPathForTests(logPath);
});

afterEach(() => {
  _setTelemetryPathForTests(null);
  delete process.env.LOOM_TELEMETRY;
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    /* windows lag */
  }
});

describe("telemetry", () => {
  it("is a no-op when LOOM_TELEMETRY is unset", () => {
    delete process.env.LOOM_TELEMETRY;
    // Re-import the config snapshot
    emit({ event: "test.noop" });
    let threw = false;
    try {
      readFileSync(logPath, "utf8");
    } catch {
      threw = true;
    }
    expect(threw).toBe(true); // file should not exist
  });
});
