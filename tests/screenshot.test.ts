import { describe, expect, it } from "vitest";
import { parseViewport } from "../src/screenshot/index.js";

describe("parseViewport", () => {
  it("resolves named presets", () => {
    expect(parseViewport("desktop")).toEqual({ width: 1280, height: 800 });
    expect(parseViewport("mobile")).toEqual({ width: 360, height: 720 });
    expect(parseViewport("tablet")).toEqual({ width: 768, height: 1024 });
    expect(parseViewport("wide")).toEqual({ width: 1440, height: 900 });
  });

  it("parses WxH dimensions", () => {
    expect(parseViewport("1920x1080")).toEqual({ width: 1920, height: 1080 });
    expect(parseViewport("400x300")).toEqual({ width: 400, height: 300 });
  });

  it("falls back to desktop on undefined or garbage", () => {
    expect(parseViewport(undefined)).toEqual({ width: 1280, height: 800 });
    expect(parseViewport("bogus")).toEqual({ width: 1280, height: 800 });
    expect(parseViewport("12345x")).toEqual({ width: 1280, height: 800 });
  });
});
