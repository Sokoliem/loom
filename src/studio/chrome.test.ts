import { describe, expect, it } from "vitest";

import { renderStudioChrome } from "./chrome.js";

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
    // The chrome-bar, stage, term-pane, preview-pane all remain.
    expect(html).toContain('class="chrome-bar"');
    expect(html).toContain('class="stage"');
    expect(html).toContain('id="term-pane"');
  });

  it("flag on: adds switcher / sidebar tabs / project header / version strip / activity feed", () => {
    const html = renderStudioChrome({ ...baseCtx, featureProjectMgmt: true });
    expect(html).toContain('data-pm="1"');
    expect(html).toContain('id="pm-switcher"');
    expect(html).toContain('id="pm-sidebar"');
    expect(html).toContain('id="pm-project-header"');
    expect(html).toContain('id="pm-version-strip"');
    expect(html).toContain('id="pm-activity"');
    expect(html).toContain('data-tab="routes"');
    expect(html).toContain('data-tab="tokens"');
    expect(html).toContain('data-tab="components"');
    expect(html).toContain('id="pm-activity-filters"');
    expect(html).toContain('id="pm-new-project"');
    // Existing chrome surfaces still present.
    expect(html).toContain('id="term-pane"');
    expect(html).toContain('id="preview"');
    // Panel script embeds the project id verbatim.
    expect(html).toContain('PROJECT_ID = "01TEST"');
    // Panel CSS shipped in the head.
    expect(html).toContain(".pm-switcher");
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
    expect(html).toContain('window.__loomDaemonSecret = DAEMON_SECRET');
  });
});
