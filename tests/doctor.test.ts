import { describe, expect, it } from "vitest";
import { runDoctor } from "../src/doctor/index.js";

describe("doctor", () => {
  it("produces checks", async () => {
    const result = await runDoctor();
    expect(result.checks.length).toBeGreaterThan(3);
    expect(["green", "yellow", "red"]).toContain(result.overall);
    expect(result.checks.find((c) => c.name === "node-version")).toBeDefined();
  });
});
