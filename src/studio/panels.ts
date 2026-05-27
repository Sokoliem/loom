/**
 * Project-management chrome surfaces (v0.10.0).
 *
 * Three-column layout when `featureProjectMgmt` is true:
 *
 *   ┌─────────────────────────── chrome-bar ───────────────────────────┐
 *   ├─────┬───────────┬────────────────────────────────────────────────┤
 *   │     │           │           pm-project-header                    │
 *   │ sw  │ sidebar   ├────────────────────────────────────────────────┤
 *   │ rail│ (groups)  │              main.stage (chat | preview)       │
 *   │     │           ├────────────────────────────────────────────────┤
 *   │     │           │           pm-version-strip                     │
 *   ├─────┴───────────┴────────────────────────────────────────────────┤
 *   │                          status footer                           │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * The switcher rail (48px) and resource sidebar (240px) span the three
 * middle rows; the work column hosts the project header, the existing
 * chat+stage `.stage` grid, and the version strip stacked vertically.
 *
 * Activity used to be a third column — it now lives inside the resource
 * sidebar as a fourth collapsible group (no DOM-level changes for the
 * activity list/filter IDs so the WS subscriber keeps working).
 *
 * When the flag is off, all three returned blocks are empty strings and the
 * chrome reverts to v0.9.6 behavior byte-for-byte (modulo the data attribute).
 */

import type { ProjectRecord } from "../types.js";

export interface PanelsContext {
  project: ProjectRecord;
  initialRoute: string;
}

export function panelsBlocks(ctx: PanelsContext): {
  shellBefore: string;
  shellAfter: string;
  css: string;
  script: string;
} {
  const projectId = ctx.project.id;
  const projectName = ctx.project.name;
  return {
    shellBefore: shellBefore(projectId, projectName),
    shellAfter: shellAfter(projectId),
    css: PANEL_CSS,
    script: panelScript(projectId, ctx.initialRoute),
  };
}

function shellBefore(projectId: string, projectName: string): string {
  return `
    <aside class="pm-switcher" id="pm-switcher" aria-label="Project switcher">
      <div class="pm-switcher-list" id="pm-project-list"></div>
      <button type="button" id="pm-new-project" class="pm-switcher-add" title="New project" aria-label="New project">＋</button>
    </aside>
    <aside class="pm-sidebar" id="pm-sidebar" aria-label="Project resources">
      <details class="pm-group" data-group="routes" open>
        <summary><span class="pm-group-label">Routes</span><span class="pm-group-caret">▾</span></summary>
        <div class="pm-tab-body" data-tab-body="routes" id="pm-routes-body">
          <div class="pm-empty">Loading routes…</div>
        </div>
      </details>
      <details class="pm-group" data-group="tokens">
        <summary><span class="pm-group-label">Tokens</span><span class="pm-group-caret">▾</span></summary>
        <div class="pm-tab-body" data-tab-body="tokens" id="pm-tokens-body">
          <div class="pm-empty">Loading tokens…</div>
        </div>
      </details>
      <details class="pm-group" data-group="components">
        <summary><span class="pm-group-label">Components</span><span class="pm-group-caret">▾</span></summary>
        <div class="pm-tab-body" data-tab-body="components" id="pm-components-body">
          <div class="pm-empty">Loading components…</div>
        </div>
      </details>
      <details class="pm-group" data-group="activity" id="pm-activity">
        <summary><span class="pm-group-label">Activity</span><span class="pm-group-caret">▾</span></summary>
        <div class="pm-tab-body" data-tab-body="activity" id="pm-activity-body">
          <div class="pm-activity-filters" id="pm-activity-filters">
            <button class="pm-chip active" data-kind="file" title="file">file</button>
            <button class="pm-chip active" data-kind="route" title="route">route</button>
            <button class="pm-chip active" data-kind="token" title="token">token</button>
            <button class="pm-chip active" data-kind="component" title="component">component</button>
            <button class="pm-chip active" data-kind="forge" title="forge">forge</button>
            <button class="pm-chip active" data-kind="panel" title="panel">panel</button>
            <button class="pm-chip active" data-kind="version" title="version">version</button>
            <button class="pm-chip active" data-kind="session" title="session">session</button>
          </div>
          <ul class="pm-activity-list" id="pm-activity-list"></ul>
        </div>
      </details>
    </aside>
    <div class="pm-project-header" id="pm-project-header" data-project="${escAttr(projectId)}">
      <div class="pm-project-name">
        <strong id="pm-name-display">${escHtml(projectName)}</strong>
        <span class="pm-git" id="pm-git" title="git status">—</span>
      </div>
      <div class="pm-project-desc" id="pm-desc">No description.</div>
    </div>
  `;
}

function shellAfter(_projectId: string): string {
  return `
    <section class="pm-version-strip" id="pm-version-strip" aria-label="Version history for current route">
      <div class="pm-version-head">
        <span class="pm-section-label">Versions for <code id="pm-version-route">/</code></span>
      </div>
      <div class="pm-version-cards" id="pm-version-cards">
        <div class="pm-empty">No versions yet.</div>
      </div>
    </section>
  `;
}

const PANEL_CSS = `
body[data-pm="1"] {
  display: grid;
  grid-template-rows: auto auto 1fr auto auto;
  grid-template-columns: 48px 240px 1fr;
}
body[data-pm="1"] .chrome-bar { grid-column: 1 / -1; grid-row: 1; }
body[data-pm="1"] .pm-switcher { grid-column: 1; grid-row: 2 / 5; }
body[data-pm="1"] .pm-sidebar { grid-column: 2; grid-row: 2 / 5; }
body[data-pm="1"] .pm-project-header { grid-column: 3; grid-row: 2; }
body[data-pm="1"] .stage { grid-column: 3; grid-row: 3; }
body[data-pm="1"] .pm-version-strip { grid-column: 3; grid-row: 4; }
body[data-pm="1"] .status { grid-column: 1 / -1; grid-row: 5; }

.pm-switcher {
  background: oklch(0.10 0.01 270);
  border-right: 1px solid var(--chrome-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
  gap: 8px;
  overflow-y: auto;
}
.pm-switcher-list { display: flex; flex-direction: column; gap: 6px; align-items: center; width: 100%; }
.pm-avatar {
  width: 32px; height: 32px; border-radius: 8px;
  display: grid; place-items: center;
  background: oklch(0.18 0.01 270);
  color: var(--chrome-muted);
  border: 1px solid transparent;
  cursor: pointer;
  font: 600 12px/1 -apple-system, "Segoe UI", system-ui, sans-serif;
  text-transform: uppercase;
  text-decoration: none;
  transition: background 80ms, border-color 80ms, color 80ms;
}
.pm-avatar:hover { background: oklch(0.22 0.01 270); color: var(--chrome-text); }
.pm-avatar.active { background: var(--chrome-accent); color: #1a1207; border-color: var(--chrome-accent); }
.pm-switcher-add {
  width: 32px; height: 32px; border-radius: 8px;
  background: transparent; border: 1px dashed var(--chrome-border);
  color: var(--chrome-muted); cursor: pointer; font-size: 16px; line-height: 1;
  margin-top: auto; flex-shrink: 0;
}
.pm-switcher-add:hover { border-color: var(--chrome-accent); color: var(--chrome-accent); }

.pm-sidebar {
  background: oklch(0.12 0.01 270);
  border-right: 1px solid var(--chrome-border);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.pm-group { border-bottom: 1px solid var(--chrome-border); display: flex; flex-direction: column; min-height: 0; }
.pm-group:last-of-type { border-bottom: none; }
.pm-group[open] { flex: 1 1 auto; min-height: 0; }
.pm-group > summary {
  list-style: none;
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px;
  cursor: pointer;
  user-select: none;
  background: oklch(0.13 0.01 270);
}
.pm-group > summary::-webkit-details-marker { display: none; }
.pm-group > summary:hover { background: oklch(0.16 0.01 270); }
.pm-group-label {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px;
  font-weight: 600; color: var(--chrome-muted);
}
.pm-group[open] .pm-group-label { color: var(--chrome-text); }
.pm-group-caret { color: var(--chrome-muted); font-size: 9px; transition: transform 120ms; transform: rotate(-90deg); }
.pm-group[open] .pm-group-caret { transform: rotate(0deg); }
.pm-tab-body {
  padding: 8px 10px 10px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  display: flex; flex-direction: column; gap: 4px;
}
.pm-empty { color: var(--chrome-muted); font-size: 11px; padding: 12px 6px; text-align: center; font-style: italic; }
.pm-list-row {
  display: flex; flex-direction: column;
  padding: 5px 7px; border-radius: 4px;
  cursor: pointer; font-size: 11.5px; line-height: 1.25;
}
.pm-list-row:hover { background: oklch(0.18 0.01 270); }
.pm-list-row.active { background: var(--chrome-accent); color: #1a1207; }
.pm-list-row code { font-family: ui-monospace, monospace; font-size: 11px; }
.pm-list-row small { color: var(--chrome-muted); font-size: 10px; margin-top: 1px; }
.pm-list-row.active small { color: rgba(26,18,7,0.7); }
.pm-search {
  width: 100%;
  background: oklch(0.16 0.01 270); border: 1px solid var(--chrome-border);
  color: var(--chrome-text);
  padding: 5px 8px; border-radius: 4px;
  font: inherit; font-size: 11.5px;
  margin-bottom: 6px;
}
.pm-search:focus { outline: 1px solid var(--chrome-accent); border-color: var(--chrome-accent); }
.pm-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1); vertical-align: -2px; margin-right: 6px; }
.pm-section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--chrome-muted); font-weight: 600; }

.pm-token-row { gap: 2px; }
.pm-token-head { display: flex; align-items: center; gap: 6px; }
.pm-token-value {
  cursor: text;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid transparent;
  font-family: ui-monospace, monospace;
  color: var(--chrome-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pm-token-value:hover { background: oklch(0.20 0.01 270); border-color: var(--chrome-border); color: var(--chrome-text); }
.pm-token-value.pm-token-broken { color: oklch(0.65 0.18 30); font-style: italic; }
.pm-token-input {
  width: 100%;
  background: oklch(0.16 0.01 270);
  border: 1px solid var(--chrome-accent);
  color: var(--chrome-text);
  padding: 2px 4px;
  border-radius: 3px;
  font: inherit;
  font-family: ui-monospace, monospace;
  font-size: 10.5px;
  outline: none;
}
.pm-token-editing .pm-token-head { opacity: 0.7; }

.pm-project-header {
  padding: 10px 16px;
  border-bottom: 1px solid var(--chrome-border);
  background: oklch(0.11 0.01 270);
  display: flex; align-items: center; gap: 14px;
}
.pm-project-name { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.pm-project-name strong { font-size: 14px; cursor: text; padding: 1px 4px; border-radius: 3px; }
.pm-project-name strong:hover { background: oklch(0.18 0.01 270); }
.pm-project-name strong[contenteditable="true"] { background: oklch(0.18 0.01 270); outline: 1px solid var(--chrome-accent); }
.pm-git { font-size: 10.5px; color: var(--chrome-muted); font-family: ui-monospace, monospace; }
.pm-git.dirty { color: oklch(0.78 0.16 70); }
.pm-project-desc {
  font-size: 11.5px; color: var(--chrome-muted);
  cursor: text; padding: 1px 6px; border-radius: 3px;
  flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pm-project-desc:hover { background: oklch(0.18 0.01 270); white-space: normal; overflow: visible; }
.pm-project-desc[contenteditable="true"] { background: oklch(0.18 0.01 270); outline: 1px solid var(--chrome-accent); color: var(--chrome-text); white-space: normal; overflow: visible; }

.pm-version-strip {
  background: oklch(0.11 0.01 270);
  border-top: 1px solid var(--chrome-border);
  padding: 8px 14px;
  overflow: hidden;
  display: flex; flex-direction: column; gap: 6px;
}
.pm-version-head { display: flex; align-items: center; gap: 8px; }
.pm-version-head code { color: var(--chrome-text); font-family: ui-monospace, monospace; font-size: 10.5px; }
.pm-version-cards { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
.pm-version-card {
  flex: 0 0 160px;
  background: oklch(0.16 0.01 270); border: 1px solid var(--chrome-border);
  border-radius: 6px; padding: 8px 10px;
  display: flex; flex-direction: column; gap: 4px;
  font-size: 11px;
}
.pm-version-card code { font-family: ui-monospace, monospace; font-size: 10.5px; color: var(--chrome-muted); }
.pm-version-card .pm-version-time { color: var(--chrome-muted); font-size: 10px; }
.pm-version-card .pm-restore-btn {
  margin-top: 4px;
  background: transparent; border: 1px solid var(--chrome-border);
  color: var(--chrome-text); border-radius: 4px;
  padding: 3px 6px; font-size: 10.5px; cursor: pointer;
}
.pm-version-card .pm-restore-btn:hover { border-color: var(--chrome-accent); color: var(--chrome-accent); }

.pm-activity-filters { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.pm-chip {
  background: transparent; border: 1px solid var(--chrome-border);
  color: var(--chrome-muted);
  font-size: 10px; padding: 2px 6px;
  border-radius: 10px; cursor: pointer;
}
.pm-chip.active { background: var(--chrome-accent); color: #1a1207; border-color: var(--chrome-accent); font-weight: 600; }
.pm-activity-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 4px;
}
.pm-activity-list li {
  padding: 6px 8px; background: oklch(0.16 0.01 270);
  border-radius: 5px;
  font-size: 11px; line-height: 1.3;
  cursor: pointer;
}
.pm-activity-list li:hover { background: oklch(0.20 0.01 270); }
.pm-activity-list li .pm-act-meta { display: flex; gap: 6px; align-items: baseline; color: var(--chrome-muted); font-size: 10px; margin-bottom: 1px; }
.pm-activity-list li .pm-act-kind { text-transform: uppercase; letter-spacing: 0.5px; font-size: 9px; }

.pm-modal-backdrop { position: fixed; inset: 0; background: rgba(8,10,14,0.55); backdrop-filter: blur(2px); z-index: 200; display: flex; align-items: center; justify-content: center; }
.pm-modal-card { background: #15181f; border: 1px solid var(--chrome-border); border-radius: 10px; width: 420px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.pm-modal-card h3 { margin: 0; font-size: 14px; }
.pm-modal-card label { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: var(--chrome-muted); }
.pm-modal-card input, .pm-modal-card select { background: oklch(0.16 0.01 270); border: 1px solid var(--chrome-border); color: var(--chrome-text); padding: 6px 8px; border-radius: 5px; font: inherit; font-size: 12px; }
.pm-modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
.pm-modal-actions button { background: oklch(0.18 0.01 270); border: 1px solid var(--chrome-border); color: var(--chrome-text); padding: 6px 12px; border-radius: 5px; font: inherit; font-size: 12px; cursor: pointer; }
.pm-modal-actions button.primary { background: var(--chrome-accent); color: #1a1207; border-color: var(--chrome-accent); font-weight: 600; }
`;

function panelScript(projectId: string, initialRoute: string): string {
  return `
(function() {
  const PROJECT_ID = ${JSON.stringify(projectId)};
  const SECRET = window.__loomDaemonSecret;
  const hdrs = SECRET ? { "content-type": "application/json", "x-loom-secret": SECRET } : { "content-type": "application/json" };
  let currentRoute = ${JSON.stringify(initialRoute)};
  const activeKinds = new Set(["file", "route", "token", "component", "forge", "panel", "version", "session"]);

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
  }
  function relTime(ms) {
    const d = Date.now() - ms;
    if (d < 60_000) return Math.max(0, Math.floor(d / 1000)) + "s ago";
    if (d < 3_600_000) return Math.floor(d / 60_000) + "m ago";
    if (d < 86_400_000) return Math.floor(d / 3_600_000) + "h ago";
    return Math.floor(d / 86_400_000) + "d ago";
  }
  function initials(name) {
    return (name || "?").trim().split(/[\\s\\-_]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
  }

  async function loadProjects() {
    try {
      const r = await fetch("/api/loom/projects");
      const j = await r.json();
      const list = $("pm-project-list");
      list.replaceChildren();
      for (const p of (j.projects || [])) {
        if (p.archived) continue;
        const a = el("a", {
          href: "#",
          class: "pm-avatar" + (p.id === PROJECT_ID ? " active" : ""),
          title: p.name,
          "aria-label": p.name,
          onclick: (e) => { e.preventDefault(); switchProject(p.id); },
        }, initials(p.name));
        list.appendChild(a);
      }
    } catch (err) { console.error("[loom-pm] loadProjects failed", err); }
  }
  async function switchProject(id) {
    if (id === PROJECT_ID) return;
    try {
      const r = await fetch("/api/loom/projects/" + id + "/open", { method: "POST", headers: hdrs });
      if (!r.ok) throw new Error("open failed");
      window.location.href = "/loom/preview/" + id + "/";
    } catch (err) { console.error("[loom-pm] switchProject failed", err); }
  }

  function openCreateDialog() {
    if (document.getElementById("pm-create-dialog")) return;
    const card = el("div", { class: "pm-modal-card" },
      el("h3", null, "New project"),
      el("label", null, "Name (lowercase, hyphens)",
        el("input", { id: "pm-create-name", type: "text", placeholder: "my-design" }),
      ),
      el("label", null, "Template",
        (() => {
          const s = el("select", { id: "pm-create-template" });
          s.appendChild(el("option", { value: "shadcn-starter" }, "shadcn-starter"));
          s.appendChild(el("option", { value: "blank" }, "blank"));
          return s;
        })(),
      ),
      el("div", { class: "pm-modal-actions" },
        el("button", { type: "button", onclick: closeCreateDialog }, "Cancel"),
        el("button", { type: "button", class: "primary", onclick: submitCreate }, "Create"),
      ),
    );
    const back = el("div", { class: "pm-modal-backdrop", id: "pm-create-dialog" }, card);
    back.addEventListener("click", (e) => { if (e.target === back) closeCreateDialog(); });
    document.body.appendChild(back);
    setTimeout(() => document.getElementById("pm-create-name").focus(), 0);
  }
  function closeCreateDialog() {
    const d = document.getElementById("pm-create-dialog");
    if (d) d.remove();
  }
  async function submitCreate() {
    const name = (document.getElementById("pm-create-name").value || "").trim();
    const template = document.getElementById("pm-create-template").value;
    if (!name) return;
    try {
      const r = await fetch("/api/loom/projects", { method: "POST", headers: hdrs, body: JSON.stringify({ name, template }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "create failed");
      window.location.href = "/loom/preview/" + j.project.id + "/";
    } catch (err) { alert("Create failed: " + err.message); }
  }

  async function loadGitStatus() {
    try {
      const r = await fetch("/api/loom/projects/" + PROJECT_ID + "/git-status");
      const j = await r.json();
      const node = $("pm-git");
      if (j.stale) { node.textContent = "—"; node.classList.remove("dirty"); return; }
      node.textContent = (j.branch || "(detached)") + (j.dirty ? " ●" : "");
      node.classList.toggle("dirty", !!j.dirty);
    } catch { /* noop */ }
  }
  function wireHeaderEdits() {
    const nameEl = $("pm-name-display");
    const descEl = $("pm-desc");
    const originals = new WeakMap();
    const editable = (node) => () => {
      originals.set(node, node.textContent || "");
      node.setAttribute("contenteditable", "true");
      node.focus();
      const range = document.createRange();
      range.selectNodeContents(node);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    };
    const save = (field, node) => async () => {
      node.removeAttribute("contenteditable");
      const value = (node.textContent || "").trim();
      const prior = originals.get(node) ?? "";
      if (value === prior) return;
      try {
        const body = {};
        body[field] = value;
        const r = await fetch("/api/loom/projects/" + PROJECT_ID, { method: "PATCH", headers: hdrs, body: JSON.stringify(body) });
        if (!r.ok) {
          const j = await r.json().catch(() => ({ error: "update failed" }));
          node.textContent = prior;
          alert("Update failed: " + (j.error || "HTTP " + r.status));
        }
      } catch (err) {
        node.textContent = prior;
        console.error("[loom-pm] save", field, err);
      }
    };
    nameEl.addEventListener("click", editable(nameEl));
    nameEl.addEventListener("blur", save("name", nameEl));
    nameEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); } });
    descEl.addEventListener("click", editable(descEl));
    descEl.addEventListener("blur", save("description", descEl));
    descEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); descEl.blur(); } });
  }

  async function loadRoutes() {
    const body = $("pm-routes-body");
    try {
      const r = await fetch("/api/loom/projects/" + PROJECT_ID + "/routes");
      const j = await r.json();
      body.replaceChildren();
      const search = el("input", { type: "search", placeholder: "Search routes…", class: "pm-search" });
      body.appendChild(search);
      const list = el("div");
      body.appendChild(list);
      const render = (filter) => {
        list.replaceChildren();
        const f = (filter || "").toLowerCase();
        const filtered = (j.routes || []).filter((rt) => !f || rt.path.toLowerCase().includes(f));
        if (filtered.length === 0) {
          list.appendChild(el("div", { class: "pm-empty" }, "No routes."));
          return;
        }
        for (const rt of filtered) {
          const row = el("div", {
            class: "pm-list-row" + (rt.path === currentRoute ? " active" : ""),
            onclick: () => selectRoute(rt.path),
          }, el("code", null, rt.path));
          if (rt.meta && rt.meta.title) row.appendChild(el("small", null, rt.meta.title));
          list.appendChild(row);
        }
      };
      search.addEventListener("input", () => render(search.value));
      render("");
    } catch (err) { body.textContent = "Failed to load routes."; }
  }
  function selectRoute(path) {
    currentRoute = path;
    const picker = document.getElementById("route-picker");
    if (picker) {
      picker.value = path;
      picker.dispatchEvent(new Event("change"));
    }
    loadVersions();
    document.querySelectorAll("#pm-routes-body .pm-list-row").forEach((row) => {
      const code = row.querySelector("code");
      row.classList.toggle("active", !!code && code.textContent === path);
    });
  }
  async function loadTokens() {
    const body = $("pm-tokens-body");
    // If the user is mid-edit on any row, skip the wholesale re-render so their
    // input doesn't get torn out of the DOM (losing typed-but-unsaved text).
    // The next refresh after they settle their edit will catch them up.
    if (body.querySelector(".pm-token-editing")) return;
    try {
      const r = await fetch("/api/loom/projects/" + PROJECT_ID + "/tokens");
      if (!r.ok) {
        body.textContent = "Failed to load tokens (HTTP " + r.status + ").";
        return;
      }
      const j = await r.json();
      body.replaceChildren();
      if (!j.tokens || j.tokens.length === 0) {
        body.appendChild(el("div", { class: "pm-empty" }, "No tokens defined."));
        return;
      }
      let currentNs = "";
      for (const t of j.tokens) {
        if (t.namespace !== currentNs) {
          body.appendChild(el("div", { class: "pm-section-label", style: "margin: 8px 0 4px 4px;" }, t.namespace));
          currentNs = t.namespace;
        }
        body.appendChild(renderTokenRow(t));
      }
    } catch (err) { body.textContent = "Failed to load tokens."; }
  }

  // Inline-editable token row. Click the value to enter edit mode; Enter saves,
  // Esc cancels. Server validates (e.g. cycle detection) and rolls back the UI
  // on rejection. Persisted via PATCH /api/loom/projects/:id/tokens.
  function renderTokenRow(t) {
    const fullKey = (t.namespace ? t.namespace + "." : "") + t.name;
    const display = t.resolved || t.raw || "";
    const isColor = display.startsWith("oklch") || /^#[0-9a-f]{3,8}$/i.test(display);
    const row = el("div", { class: "pm-list-row pm-token-row" });
    const codeWrap = el("div", { class: "pm-token-head" });
    if (isColor) codeWrap.appendChild(el("span", { class: "pm-swatch", style: "background:" + display }));
    codeWrap.appendChild(el("code", null, t.name));
    row.appendChild(codeWrap);

    const valueEl = el("small", { class: "pm-token-value", title: "Click to edit" }, t.raw || "");
    if (t.error) valueEl.classList.add("pm-token-broken");
    row.appendChild(valueEl);

    let original = t.raw || "";
    const enterEdit = () => {
      if (row.classList.contains("pm-token-editing")) return;
      row.classList.add("pm-token-editing");
      const input = el("input", { type: "text", value: original, class: "pm-token-input", spellcheck: "false" });
      valueEl.replaceWith(input);
      input.focus();
      input.select();
      let settled = false;
      const settle = (commit) => {
        if (settled) return;
        settled = true;
        row.classList.remove("pm-token-editing");
        const next = input.value;
        const restore = (text) => {
          const small = el("small", { class: "pm-token-value", title: "Click to edit" }, text);
          small.addEventListener("click", enterEdit);
          input.replaceWith(small);
        };
        if (!commit || next === original) {
          restore(original);
          return;
        }
        savePatch(fullKey, next).then((ok) => {
          if (ok) {
            original = next;
            restore(next);
            // Resolved display updates on the next loadTokens() refresh, which
            // fires when the daemon's token_changed event bubbles through the WS
            // listener in chrome.ts. The CSS hot-swap also fires there.
          } else {
            restore(original);
          }
        });
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); settle(true); }
        else if (e.key === "Escape") { e.preventDefault(); settle(false); }
      });
      input.addEventListener("blur", () => settle(true));
    };
    valueEl.addEventListener("click", enterEdit);
    return row;
  }

  async function savePatch(key, value) {
    try {
      const r = await fetch("/api/loom/projects/" + PROJECT_ID + "/tokens", {
        method: "PATCH",
        headers: hdrs,
        body: JSON.stringify({ key, value }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: "HTTP " + r.status }));
        alert("Token update failed: " + (j.error || "unknown"));
        return false;
      }
      return true;
    } catch (err) {
      alert("Token update failed: " + err.message);
      return false;
    }
  }
  async function loadComponents() {
    const body = $("pm-components-body");
    try {
      const r = await fetch("/api/loom/projects/" + PROJECT_ID + "/components");
      const j = await r.json();
      body.replaceChildren();
      if (!j.components || j.components.length === 0) {
        body.appendChild(el("div", { class: "pm-empty" }, "No components yet."));
        return;
      }
      for (const c of j.components) {
        const meta = [
          c.hasSpec ? "spec" : null,
          c.hasTokens ? "tokens" : null,
          c.hasA11y ? "a11y" : null,
          c.hasStories ? "stories" : null,
        ].filter(Boolean).join(" · ");
        const row = el("div", { class: "pm-list-row" },
          el("code", null, c.name),
          el("small", null, meta || "—"),
        );
        body.appendChild(row);
      }
    } catch (err) { body.textContent = "Failed to load components."; }
  }

  async function loadVersions() {
    const cards = $("pm-version-cards");
    const routeLabel = $("pm-version-route");
    if (routeLabel) routeLabel.textContent = currentRoute;
    try {
      const url = "/api/loom/projects/" + PROJECT_ID + "/versions?route=" + encodeURIComponent(currentRoute);
      const r = await fetch(url);
      const j = await r.json();
      cards.replaceChildren();
      if (!j.versions || j.versions.length === 0) {
        cards.appendChild(el("div", { class: "pm-empty" }, "No versions for this route yet."));
        return;
      }
      for (const v of j.versions) {
        const card = el("div", { class: "pm-version-card" },
          el("code", null, v.id.slice(0, 10)),
          el("div", { class: "pm-version-time" }, relTime(v.createdAt) + " · " + v.createdBy),
          el("button", {
            type: "button",
            class: "pm-restore-btn",
            onclick: () => restoreVersion(v.id),
          }, "Restore"),
        );
        cards.appendChild(card);
      }
    } catch (err) { console.error("[loom-pm] loadVersions", err); }
  }
  async function restoreVersion(vid) {
    if (!confirm("Restore version " + vid.slice(0, 10) + "?\\nCurrent state will be snapshotted first.")) return;
    try {
      const r = await fetch("/api/loom/projects/" + PROJECT_ID + "/versions/" + vid + "/restore", { method: "POST", headers: hdrs });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "restore failed");
      loadVersions();
    } catch (err) { alert("Restore failed: " + err.message); }
  }

  function renderActivityRow(e) {
    return el("li", { onclick: () => activityClick(e) },
      el("div", { class: "pm-act-meta" },
        el("span", { class: "pm-act-kind" }, e.kind),
        e.subkind ? el("span", null, e.subkind) : null,
        el("span", null, "·"),
        el("span", null, relTime(e.createdAt)),
      ),
      el("div", null, e.title),
    );
  }
  function activityClick(e) {
    if (e.refPath && (e.kind === "route" || e.kind === "token" || e.kind === "component")) {
      const groupName = e.kind === "route" ? "routes" : e.kind === "token" ? "tokens" : "components";
      const grp = document.querySelector('.pm-group[data-group="' + groupName + '"]');
      if (grp) grp.setAttribute("open", "");
    }
  }
  async function loadActivity() {
    const list = $("pm-activity-list");
    try {
      const kinds = Array.from(activeKinds).join(",");
      const r = await fetch("/api/loom/projects/" + PROJECT_ID + "/activity?limit=50&kind=" + kinds);
      const j = await r.json();
      list.replaceChildren();
      for (const e of (j.events || [])) {
        list.appendChild(renderActivityRow(e));
      }
    } catch (err) { console.error("[loom-pm] loadActivity", err); }
  }
  function wireActivityFilters() {
    document.querySelectorAll("#pm-activity-filters .pm-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const k = chip.dataset.kind;
        if (activeKinds.has(k)) activeKinds.delete(k);
        else activeKinds.add(k);
        chip.classList.toggle("active");
        loadActivity();
      });
    });
  }
  function subscribeActivity() {
    let ws = null;
    let backoff = 250;
    const connect = () => {
      try {
        const proto = location.protocol === "https:" ? "wss" : "ws";
        ws = new WebSocket(proto + "://" + location.host + "/api/loom/projects/" + PROJECT_ID + "/activity/stream");
        ws.onopen = () => { backoff = 250; };
        ws.onmessage = (m) => {
          try {
            const data = JSON.parse(m.data);
            if (data.kind !== "event" || !data.event) return;
            const e = data.event;
            if (!activeKinds.has(e.kind)) return;
            const list = $("pm-activity-list");
            list.insertBefore(renderActivityRow(e), list.firstChild);
            while (list.childElementCount > 50) list.removeChild(list.lastChild);
          } catch { /* ignore */ }
        };
        ws.onclose = () => {
          setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, 4000);
        };
        ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
      } catch (err) {
        setTimeout(connect, backoff);
      }
    };
    connect();
  }

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      const list = $("pm-project-list");
      const first = list && list.querySelector("a");
      if (first) first.focus();
    }
  });

  function boot() {
    $("pm-new-project").addEventListener("click", openCreateDialog);
    wireHeaderEdits();
    wireActivityFilters();
    loadProjects();
    loadGitStatus();
    setInterval(loadGitStatus, 5000);
    loadRoutes();
    loadTokens();
    loadComponents();
    loadVersions();
    loadActivity();
    subscribeActivity();

    const picker = document.getElementById("route-picker");
    if (picker) picker.addEventListener("change", () => {
      currentRoute = picker.value;
      loadVersions();
      document.querySelectorAll("#pm-routes-body .pm-list-row").forEach((row) => {
        const code = row.querySelector("code");
        row.classList.toggle("active", !!code && code.textContent === currentRoute);
      });
    });

    // Wire the v0.11 live-nav bus: chrome.ts emits this CustomEvent after the
    // daemon WS reports a route/component file change. Re-fetch the sidebar
    // list so freshly-claude-generated routes appear without page reload.
    window.addEventListener("loom:routes-refreshed", () => {
      loadRoutes();
      loadComponents();
    });
    // Token edits fire token_changed from the daemon; chrome.ts re-broadcasts
    // as a CustomEvent so we can refresh the resolved swatch + value.
    window.addEventListener("loom:tokens-changed", () => loadTokens());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
`;
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function escAttr(s: string): string {
  return escHtml(s);
}
