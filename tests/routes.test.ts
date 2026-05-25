import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  routeCreate,
  routeDelete,
  routeGet,
  routeList,
  routeUpdate,
} from "../src/core/routes.js";

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "loom-routes-"));
  mkdirSync(join(root, "routes"), { recursive: true });
  return root;
}

describe("routes", () => {
  it("creates and lists routes", () => {
    const dir = project();
    routeCreate(dir, "/", "export default () => <main>home</main>;");
    routeCreate(dir, "/pricing", "export default () => <main>pricing</main>;", {
      title: "Pricing",
      state: "draft",
    });
    const list = routeList(dir);
    expect(list.map((r) => r.path).sort()).toEqual(["/", "/pricing"]);
  });

  it("round-trips meta", () => {
    const dir = project();
    routeCreate(dir, "/about", "export default () => null;", {
      title: "About",
      state: "approved",
    });
    const rec = routeGet(dir, "/about");
    expect(rec.meta).toMatchObject({ title: "About", state: "approved" });
  });

  it("updates body and meta", () => {
    const dir = project();
    routeCreate(dir, "/x", "export default () => null;", { title: "X" });
    routeUpdate(dir, "/x", { meta: { title: "X2", state: "in-review" } });
    expect(routeGet(dir, "/x").meta.title).toBe("X2");
  });

  it("rejects bad paths", () => {
    const dir = project();
    expect(() => routeCreate(dir, "Pricing", "x")).toThrow();
  });

  it("deletes", () => {
    const dir = project();
    routeCreate(dir, "/x", "export default () => null;");
    routeDelete(dir, "/x");
    expect(() => routeGet(dir, "/x")).toThrow();
  });
});
