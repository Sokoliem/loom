import { describe, expect, it } from "vitest";

import { buildFlagsFromConfig, renderStudioChrome } from "./chrome.js";

const baseCtx = {
  project: {
    id: "01TEST",
    name: "smoke-project",
    path: "C:/tmp/smoke-project",
    createdAt: 1_700_000_000_000,
    lastOpenedAt: 1_700_000_000_000,
    archived: false,
  },
  vitePort: 5173,
  daemonPort: 5180,
  routes: [{ path: "/" }, { path: "/about" }],
  daemonSecret: "deadbeef",
};

describe("renderStudioChrome (project-mgmt flag)", () => {
  it("flag off: renders v0.9.6-shape chrome with no pm-* additions", () => {
    const html = renderStudioChrome({ ...baseCtx, featureProjectMgmt: false });
    expect(html).not.toContain('data-pm="1"');
    expect(html).not.toContain('id="pm-switcher"');
    expect(html).not.toContain('id="pm-activity"');
    expect(html).not.toContain('id="pm-version-strip"');
    expect(html).toContain('class="chrome-bar"');
    expect(html).toContain('class="stage"');
    expect(html).toContain('id="term-pane"');
  });

  it("flag on: renders switcher rail, sidebar groups, project header, version strip", () => {
    const html = renderStudioChrome({ ...baseCtx, featureProjectMgmt: true });
    expect(html).toContain('data-pm="1"');
    expect(html).toContain('id="pm-switcher"');
    expect(html).toContain('id="pm-sidebar"');
    expect(html).toContain('id="pm-project-header"');
    expect(html).toContain('id="pm-version-strip"');
    expect(html).toContain('id="pm-activity"');
    expect(html).toContain('data-group="routes"');
    expect(html).toContain('data-group="tokens"');
    expect(html).toContain('data-group="components"');
    expect(html).toContain('data-group="activity"');
    expect(html).toContain('data-tab-body="routes"');
    expect(html).toContain('data-tab-body="activity"');
    expect(html).toContain('id="pm-activity-filters"');
    expect(html).toContain('id="pm-new-project"');
    expect(html).toContain('id="term-pane"');
    expect(html).toContain('id="preview"');
    expect(html).toContain('PROJECT_ID = "01TEST"');
    expect(html).toContain(".pm-switcher");
  });

  it("flag on: activity lives inside the sidebar (no top-level pm-activity aside)", () => {
    const html = renderStudioChrome({ ...baseCtx, featureProjectMgmt: true });
    // pm-activity is now a <details> group inside the sidebar, not a top-level aside.
    expect(html).not.toMatch(/<aside[^>]*id="pm-activity"/);
    // Activity body sits inside the sidebar aside.
    const sidebarStart = html.indexOf('id="pm-sidebar"');
    const activityBodyStart = html.indexOf('id="pm-activity-body"');
    const sidebarEnd = html.indexOf("</aside>", sidebarStart);
    expect(sidebarStart).toBeGreaterThan(-1);
    expect(activityBodyStart).toBeGreaterThan(sidebarStart);
    expect(activityBodyStart).toBeLessThan(sidebarEnd);
  });

  it("flag on: project header sits in shellBefore so it renders above the stage", () => {
    const html = renderStudioChrome({ ...baseCtx, featureProjectMgmt: true });
    const headerIdx = html.indexOf('id="pm-project-header"');
    const stageIdx = html.indexOf('class="stage"');
    expect(headerIdx).toBeGreaterThan(-1);
    expect(stageIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeLessThan(stageIdx);
  });

  it("flag on: escapes project name in the header to prevent HTML injection", () => {
    const html = renderStudioChrome({
      ...baseCtx,
      project: { ...baseCtx.project, name: "<script>alert(1)</script>" },
      featureProjectMgmt: true,
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("flag on: exposes the daemon secret on window for the panel script", () => {
    const html = renderStudioChrome({ ...baseCtx, featureProjectMgmt: true });
    expect(html).toContain("window.__loomDaemonSecret = DAEMON_SECRET");
  });
});

describe("buildFlagsFromConfig", () => {
  it("empty config yields empty argv", () => {
    expect(buildFlagsFromConfig({})).toEqual([]);
    expect(buildFlagsFromConfig({ checks: [], model: "", extra: "" })).toEqual([]);
  });

  it("checks + model flow to argv in order", () => {
    expect(
      buildFlagsFromConfig({
        checks: ["--continue", "--verbose"],
        model: "opus",
        extra: "",
      }),
    ).toEqual(["--continue", "--verbose", "--model", "opus"]);
  });

  it("extra args split on whitespace", () => {
    expect(
      buildFlagsFromConfig({ checks: [], model: "", extra: "--debug-keys --foo=bar" }),
    ).toEqual(["--debug-keys", "--foo=bar"]);
  });

  it("extra args tolerate leading/trailing/multi-space whitespace", () => {
    expect(
      buildFlagsFromConfig({ checks: [], model: "", extra: "   --x   --y  --z\t--w" }),
    ).toEqual(["--x", "--y", "--z", "--w"]);
  });

  it("falsy fields are no-ops", () => {
    expect(buildFlagsFromConfig({ model: "" })).toEqual([]);
    expect(buildFlagsFromConfig({ extra: "   " })).toEqual([]);
  });

  it("client/server flag-builder structural parity", () => {
    // Catch drift between this TS implementation and the inline function literal
    // embedded in chromeScript. Structural assertions only — no eval — to avoid
    // executing rendered HTML in the test runner.
    const html = renderStudioChrome({ ...baseCtx, featureProjectMgmt: false });
    const match = html.match(/function buildFlagsFromConfig\(cfg\)\s*\{[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    const inlineSrc = match![0];
    // Same shape: spread checks, push model, split extra on whitespace.
    expect(inlineSrc).toContain("[...(cfg.checks || [])]");
    expect(inlineSrc).toContain('flags.push("--model", cfg.model)');
    expect(inlineSrc).toMatch(/cfg\.extra\.trim\(\)\.split\(\/\\\\?s\+\/\)/);
    expect(inlineSrc).toContain("if (tok) flags.push(tok)");
  });
});
