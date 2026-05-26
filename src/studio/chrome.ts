import type { ProjectRecord } from "../types.js";

export interface ChromeContext {
  project: ProjectRecord;
  vitePort: number;
  daemonPort: number;
  routes: { path: string }[];
  /**
   * The daemon's shared secret. Embedded into the chrome's inline JS so the
   * browser can authenticate mutating fetches (e.g. `/api/loom/terminal/start`).
   * Safe because the chrome is only ever served to the same-origin localhost
   * browser; the secret protects against cross-origin reads, not local ones.
   */
  daemonSecret: string;
}

/**
 * Return the static HTML for the loom studio chrome. The iframe inside loads
 * the per-project Vite dev server, which in turn renders the user's routes.
 */
export function renderStudioChrome(ctx: ChromeContext): string {
  const routes = ctx.routes
    .map((r) => r.path)
    .sort()
    .map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`)
    .join("");
  const initialRoute = ctx.routes.some((r) => r.path === "/") ? "/" : (ctx.routes[0]?.path ?? "/");
  const viteOrigin = `http://127.0.0.1:${ctx.vitePort}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>loom · ${escapeHtml(ctx.project.name)}</title>
    <style>${CHROME_CSS}</style>
  </head>
  <body>
    <header class="chrome-bar">
      <div class="brand">
        <span class="logo">◐</span>
        <div class="brand-text">
          <strong>${escapeHtml(ctx.project.name)}</strong>
          <span class="path" title="${escapeHtml(ctx.project.path)}">${escapeHtml(short(ctx.project.path))}</span>
        </div>
      </div>

      <div class="ctrl">
        <label class="ctrl-group">
          <span class="ctrl-label">Route</span>
          <select id="route-picker">${routes}</select>
        </label>
        <label class="ctrl-group">
          <span class="ctrl-label">Viewport</span>
          <select id="viewport-picker">
            <option value="fit">Fit window</option>
            <option value="360x720">Mobile · 360</option>
            <option value="768x1024">Tablet · 768</option>
            <option value="1280x800">Desktop · 1280</option>
            <option value="1440x900">Wide · 1440</option>
          </select>
        </label>
        <div class="ctrl-group">
          <span class="ctrl-label">Theme</span>
          <div class="seg" role="tablist">
            <button data-theme="light" class="active" aria-pressed="true">Light</button>
            <button data-theme="dark" aria-pressed="false">Dark</button>
          </div>
        </div>
        <button id="reload" class="reload" title="Reload preview">↻</button>
      </div>
    </header>

    <main class="stage" id="stage">
      <section class="term-pane" id="term-pane">
        <div class="term-header">
          <strong>claude</strong>
          <span class="term-meta" id="term-status">idle</span>
          <span class="term-spacer"></span>
          <button id="term-toggle" class="term-btn">Start session</button>
        </div>
        <div class="term-host" id="term-host" tabindex="0"></div>
      </section>
      <div class="split-handle" id="split-handle" aria-label="Resize panes" role="separator"></div>
      <section class="preview-pane">
        <div id="frame-wrap" class="frame-wrap" data-viewport="fit">
          <iframe id="preview" src="${viteOrigin}/?route=${encodeURIComponent(initialRoute)}&theme=light" title="loom preview"></iframe>
          <div class="viewport-label"><span id="vp-label">Fit</span></div>
        </div>
      </section>
    </main>
    <div id="flags-modal" class="modal" hidden aria-hidden="true">
      <div class="modal-backdrop" data-modal-close></div>
      <form class="modal-card" id="flags-form">
        <div class="modal-head">
          <strong>Start claude session</strong>
          <span class="modal-sub">flags persist per-project</span>
        </div>
        <div class="modal-body">
          <div class="modal-section">
            <div class="modal-section-label">Common flags</div>
            <label class="flag-row">
              <input type="checkbox" name="flag" value="--dangerously-skip-permissions" />
              <div>
                <code>--dangerously-skip-permissions</code>
                <span>Skip all permission prompts for the session</span>
              </div>
            </label>
            <label class="flag-row">
              <input type="checkbox" name="flag" value="--continue" />
              <div>
                <code>--continue</code>
                <span>Resume the most recent claude session in this directory</span>
              </div>
            </label>
            <label class="flag-row">
              <input type="checkbox" name="flag" value="--verbose" />
              <div>
                <code>--verbose</code>
                <span>Verbose logging from the CLI</span>
              </div>
            </label>
            <label class="flag-row">
              <input type="checkbox" name="flag" value="--no-auto-update" />
              <div>
                <code>--no-auto-update</code>
                <span>Disable auto-update check at startup</span>
              </div>
            </label>
          </div>
          <div class="modal-section">
            <div class="modal-section-label">Model</div>
            <select id="flag-model">
              <option value="">Default (whatever claude picks)</option>
              <option value="opus">opus</option>
              <option value="sonnet">sonnet</option>
              <option value="haiku">haiku</option>
            </select>
          </div>
          <div class="modal-section">
            <div class="modal-section-label">Extra args</div>
            <input id="flag-extra" type="text" placeholder="e.g. --debug-keys" />
            <span class="modal-hint">Space-separated; forwarded verbatim to <code>claude</code>.</span>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" data-modal-close>Cancel</button>
          <button type="submit" class="btn primary">Start session</button>
        </div>
      </form>
    </div>

    <script src="/__loom/vendor/terminal.js?v=${Date.now()}" defer></script>

    <footer class="status">
      <span class="dot" id="ws-dot"></span>
      <span id="ws-text">connecting…</span>
      <span class="sep">·</span>
      <span>vite :${ctx.vitePort}</span>
      <span class="sep">·</span>
      <span id="last-event">idle</span>
    </footer>

    <script>${chromeScript(ctx)}</script>
  </body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]!);
}

function short(p: string): string {
  return p.replace(/\\/g, "/").replace(/^.*?\/([^/]+\/[^/]+)$/, "…/$1");
}

const CHROME_CSS = `
:root {
  --chrome-bg: #0f1115;
  --chrome-border: #20232a;
  --chrome-text: #e6e8eb;
  --chrome-muted: #8b8f99;
  --chrome-accent: oklch(0.72 0.16 38);
  --chrome-success: #3fb950;
  --stage-bg: #f4f4f6;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; background: var(--chrome-bg); color: var(--chrome-text); font-family: -apple-system, "Segoe UI", system-ui, sans-serif; font-size: 12.5px; }
body { display: grid; grid-template-rows: auto 1fr auto; }

.chrome-bar { display: flex; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--chrome-border); gap: 16px; }
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.logo { width: 24px; height: 24px; border-radius: 6px; background: linear-gradient(135deg, oklch(0.30 0.04 38), oklch(0.45 0.08 38)); display: grid; place-items: center; font-size: 13px; color: white; flex-shrink: 0; }
.brand-text { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.brand-text strong { font-size: 13px; font-weight: 600; }
.brand-text .path { font-size: 10.5px; color: var(--chrome-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }

.ctrl { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.ctrl-group { display: inline-flex; flex-direction: column; gap: 2px; }
.ctrl-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--chrome-muted); font-weight: 600; }
.ctrl select, .ctrl button { background: #1a1d24; border: 1px solid var(--chrome-border); color: var(--chrome-text); padding: 4px 8px; border-radius: 5px; font: inherit; font-size: 12px; }
.ctrl select { min-width: 110px; }
.ctrl select:focus, .ctrl button:focus { outline: 1px solid var(--chrome-accent); outline-offset: 1px; }

.seg { display: inline-flex; background: #1a1d24; border: 1px solid var(--chrome-border); border-radius: 5px; padding: 1px; }
.seg button { background: transparent; border: none; padding: 3px 8px; font-size: 11.5px; border-radius: 3px; color: var(--chrome-muted); }
.seg button.active { background: var(--chrome-accent); color: #1a1207; font-weight: 600; }

.reload { width: 28px; padding: 0 !important; font-size: 14px; }

.stage { background: var(--stage-bg); display: grid; grid-template-columns: var(--split, 460px) 6px 1fr; min-height: 0; overflow: hidden; }
.split-handle { background: var(--chrome-border); cursor: col-resize; transition: background 100ms; }
.split-handle:hover, .split-handle.dragging { background: var(--chrome-accent); }
.term-pane { display: flex; flex-direction: column; min-width: 0; background: oklch(0.14 0.01 38); color: oklch(0.92 0.01 38); border-right: 1px solid var(--chrome-border); }
.term-header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--chrome-border); background: var(--chrome-bg); font-size: 11.5px; }
.term-header strong { font-weight: 600; color: var(--chrome-text); }
.term-meta { font-size: 10.5px; color: var(--chrome-muted); }
.term-spacer { flex: 1; }
.term-btn { background: var(--chrome-accent); color: #1a1207; border: none; padding: 3px 10px; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer; }
.term-btn[data-running] { background: transparent; color: var(--chrome-muted); border: 1px solid var(--chrome-border); }
.term-btn[data-running]:hover { color: #f85149; border-color: #f85149; }
.term-host { flex: 1; padding: 8px; overflow: auto; outline: none; font-family: 'Cascadia Mono', 'Menlo', ui-monospace, monospace; font-size: 12.5px; line-height: 1.35; }
.term-host:empty::before { content: 'Click "Start session" to launch claude in this project.'; color: var(--chrome-muted); font-style: italic; }
.preview-pane { display: flex; align-items: start; justify-content: center; padding: 18px; overflow: auto; background: var(--stage-bg); min-width: 0; }
.frame-wrap { position: relative; background: white; border: 1px solid #d0d2d6; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 12px 28px -16px rgba(0,0,0,0.18); overflow: hidden; }
.frame-wrap[data-viewport="fit"] { width: 100%; max-width: 1440px; height: calc(100vh - 100px); }
.frame-wrap[data-viewport="360x720"] { width: 360px; height: 720px; }
.frame-wrap[data-viewport="768x1024"] { width: 768px; height: 1024px; }
.frame-wrap[data-viewport="1280x800"] { width: 1280px; height: 800px; }
.frame-wrap[data-viewport="1440x900"] { width: 1440px; height: 900px; }
iframe { width: 100%; height: 100%; border: 0; display: block; background: white; }
.viewport-label { position: absolute; top: 6px; right: 8px; background: rgba(0,0,0,0.55); color: white; font-size: 10px; padding: 2px 6px; border-radius: 3px; pointer-events: none; }

.modal { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; }
.modal[hidden] { display: none; }
.modal-backdrop { position: absolute; inset: 0; background: rgba(8,10,14,0.55); backdrop-filter: blur(2px); }
.modal-card { position: relative; background: #15181f; border: 1px solid var(--chrome-border); border-radius: 10px; width: 460px; max-width: calc(100vw - 32px); box-shadow: 0 24px 60px -16px rgba(0,0,0,0.5); display: flex; flex-direction: column; max-height: calc(100vh - 64px); }
.modal-head { padding: 14px 16px 10px; border-bottom: 1px solid var(--chrome-border); display: flex; align-items: baseline; gap: 8px; }
.modal-head strong { font-size: 13.5px; font-weight: 600; }
.modal-sub { font-size: 11px; color: var(--chrome-muted); }
.modal-body { padding: 12px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.modal-section { display: flex; flex-direction: column; gap: 6px; }
.modal-section-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--chrome-muted); font-weight: 600; }
.modal-section select, .modal-section input[type=text] { background: #0f1115; border: 1px solid var(--chrome-border); color: var(--chrome-text); border-radius: 5px; padding: 6px 8px; font: inherit; font-size: 12px; }
.modal-section select:focus, .modal-section input[type=text]:focus { outline: 1px solid var(--chrome-accent); outline-offset: 1px; }
.modal-hint { font-size: 10.5px; color: var(--chrome-muted); }
.flag-row { display: flex; align-items: flex-start; gap: 10px; padding: 7px 8px; border-radius: 6px; cursor: pointer; transition: background 80ms; }
.flag-row:hover { background: #1a1d24; }
.flag-row input { margin-top: 3px; accent-color: var(--chrome-accent); }
.flag-row code { display: block; font-family: 'Cascadia Mono', ui-monospace, monospace; font-size: 11.5px; color: var(--chrome-text); }
.flag-row span { display: block; font-size: 11px; color: var(--chrome-muted); margin-top: 2px; }
.modal-foot { padding: 10px 16px 14px; border-top: 1px solid var(--chrome-border); display: flex; justify-content: flex-end; gap: 8px; }
.btn { background: #1a1d24; border: 1px solid var(--chrome-border); color: var(--chrome-text); padding: 6px 12px; border-radius: 5px; font: inherit; font-size: 12px; cursor: pointer; }
.btn.primary { background: var(--chrome-accent); color: #1a1207; font-weight: 600; border-color: transparent; }
.btn:hover { border-color: var(--chrome-muted); }
.btn.primary:hover { filter: brightness(1.05); }
.status { display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-top: 1px solid var(--chrome-border); font-size: 11px; color: var(--chrome-muted); background: var(--chrome-bg); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #555; }
.dot.ok { background: var(--chrome-success); }
.dot.err { background: #f85149; }
.sep { opacity: 0.5; }
`;

function chromeScript(ctx: ChromeContext): string {
  const initialRoute = ctx.routes.some((r) => r.path === "/") ? "/" : (ctx.routes[0]?.path ?? "/");
  return `
const VITE_ORIGIN = ${JSON.stringify(`http://127.0.0.1:${ctx.vitePort}`)};
const DAEMON_WS = ${JSON.stringify(`ws://127.0.0.1:${ctx.daemonPort}/api/loom/ws`)};
const TERM_WS = ${JSON.stringify(`ws://127.0.0.1:${ctx.daemonPort}/api/loom/terminal/ws?projectId=${ctx.project.id}`)};
const PROJECT_ID = ${JSON.stringify(ctx.project.id)};
const DAEMON_SECRET = ${JSON.stringify(ctx.daemonSecret)};
const VIEWPORT_LABELS = { fit: "Fit", "360x720": "Mobile · 360", "768x1024": "Tablet · 768", "1280x800": "Desktop · 1280", "1440x900": "Wide · 1440" };

const state = { route: ${JSON.stringify(initialRoute)}, theme: "light", viewport: "fit" };
const $ = (id) => document.getElementById(id);

function syncIframe() {
  const url = new URL(VITE_ORIGIN + "/");
  url.searchParams.set("route", state.route);
  url.searchParams.set("theme", state.theme);
  url.searchParams.set("ts", String(Date.now()));
  const iframe = $("preview");
  iframe.src = url.toString();
}

function postToIframe(msg) {
  const iframe = $("preview");
  try { iframe.contentWindow && iframe.contentWindow.postMessage(msg, "*"); } catch {}
}

$("route-picker").value = state.route;
$("route-picker").addEventListener("change", (e) => {
  state.route = e.target.value;
  postToIframe({ kind: "loom:route", path: state.route });
});

$("viewport-picker").addEventListener("change", (e) => {
  state.viewport = e.target.value;
  $("frame-wrap").setAttribute("data-viewport", state.viewport);
  $("vp-label").textContent = VIEWPORT_LABELS[state.viewport] || state.viewport;
});

for (const btn of document.querySelectorAll(".seg button")) {
  btn.addEventListener("click", () => {
    state.theme = btn.dataset.theme;
    document.querySelectorAll(".seg button").forEach((b) => {
      b.classList.toggle("active", b.dataset.theme === state.theme);
      b.setAttribute("aria-pressed", b.dataset.theme === state.theme ? "true" : "false");
    });
    postToIframe({ kind: "loom:theme", theme: state.theme });
  });
}

$("reload").addEventListener("click", syncIframe);

// WS connection to daemon — react to file changes by either telling Vite to reload
// (Vite handles HMR itself for module changes) or doing a hard reload for token changes.
function connectWS() {
  const dot = $("ws-dot"), text = $("ws-text"), last = $("last-event");
  try {
    const ws = new WebSocket(DAEMON_WS);
    ws.onopen = () => { dot.className = "dot ok"; text.textContent = "live"; };
    ws.onclose = () => { dot.className = "dot err"; text.textContent = "disconnected"; setTimeout(connectWS, 1500); };
    ws.onerror = () => { dot.className = "dot err"; };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.kind === "manifest_changed" || m.kind === "route_changed" || m.kind === "token_changed") {
          last.textContent = m.kind + " · " + new Date().toLocaleTimeString();
          // tokens.css needs a hard reload (HMR can't see the daemon-served CSS)
          if (m.kind === "token_changed" || (m.path && /tokens\\//.test(m.path))) {
            syncIframe();
          }
        }
      } catch {}
    };
  } catch (err) {
    setTimeout(connectWS, 1500);
  }
}
connectWS();

// -- Terminal pane (claude session) ----------------------------------
const termHost = $("term-host");
const termStatus = $("term-status");
const termToggle = $("term-toggle");
let termDispose = null;

function setTermStatus(s, detail) {
  const label = { connecting: "connecting…", open: "live", closed: "disconnected", exited: "exited" + (detail ? " (" + detail + ")" : ""), error: "error" + (detail ? " · " + detail : "") };
  termStatus.textContent = label[s] || s;
}

async function startTerminal(flags) {
  termToggle.disabled = true;
  termStatus.textContent = "starting…";
  try {
    const r = await fetch("/api/loom/terminal/start", {
      method: "POST",
      headers: { "content-type": "application/json", "x-loom-secret": DAEMON_SECRET },
      body: JSON.stringify({ projectId: PROJECT_ID, flags: flags || [] }),
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
  } catch (err) {
    setTermStatus("error", err.message);
    termToggle.disabled = false;
    return;
  }
  termHost.replaceChildren();
  if (typeof window.__loomTerminal !== "function") {
    setTermStatus("error", "terminal client not loaded");
    termToggle.disabled = false;
    return;
  }
  termDispose = window.__loomTerminal({
    host: termHost,
    wsUrl: TERM_WS,
    onStatus: setTermStatus,
  });
  termToggle.textContent = "Stop";
  termToggle.setAttribute("data-running", "1");
  termToggle.disabled = false;
}

async function stopTerminal() {
  termToggle.disabled = true;
  if (termDispose) { try { termDispose(); } catch {} termDispose = null; }
  try {
    await fetch("/api/loom/terminal/stop", {
      method: "POST",
      headers: { "content-type": "application/json", "x-loom-secret": DAEMON_SECRET },
      body: JSON.stringify({ projectId: PROJECT_ID }),
    });
  } catch {}
  termHost.replaceChildren();
  termToggle.textContent = "Start session";
  termToggle.removeAttribute("data-running");
  setTermStatus("closed");
  termToggle.disabled = false;
}

// -- Pre-start config modal --------------------------------------------
const FLAGS_KEY = "loom:claude-flags:" + PROJECT_ID;
const flagsModal = $("flags-modal");
const flagsForm = $("flags-form");
const flagModel = $("flag-model");
const flagExtra = $("flag-extra");

function loadFlagsConfig() {
  try {
    const raw = localStorage.getItem(FLAGS_KEY);
    return raw ? JSON.parse(raw) : { checks: [], model: "", extra: "" };
  } catch {
    return { checks: [], model: "", extra: "" };
  }
}
function saveFlagsConfig(cfg) {
  try { localStorage.setItem(FLAGS_KEY, JSON.stringify(cfg)); } catch {}
}
function buildFlagsFromConfig(cfg) {
  const flags = [...(cfg.checks || [])];
  if (cfg.model) flags.push("--model", cfg.model);
  if (cfg.extra) {
    // Split on whitespace; ignore empty tokens. Quoted args aren't supported
    // here — for that, edit the persisted JSON directly or pass via MCP.
    for (const tok of cfg.extra.trim().split(/\\s+/)) if (tok) flags.push(tok);
  }
  return flags;
}
function populateModalFromConfig(cfg) {
  for (const cb of flagsForm.querySelectorAll("input[name=flag]")) {
    cb.checked = (cfg.checks || []).indexOf(cb.value) !== -1;
  }
  flagModel.value = cfg.model || "";
  flagExtra.value = cfg.extra || "";
}
function openFlagsModal() {
  populateModalFromConfig(loadFlagsConfig());
  flagsModal.removeAttribute("hidden");
  flagsModal.setAttribute("aria-hidden", "false");
  setTimeout(() => flagExtra.focus(), 0);
}
function closeFlagsModal() {
  flagsModal.setAttribute("hidden", "");
  flagsModal.setAttribute("aria-hidden", "true");
}
flagsModal.addEventListener("click", (e) => {
  if (e.target.hasAttribute("data-modal-close")) closeFlagsModal();
});
flagsModal.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeFlagsModal();
});
flagsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const cfg = {
    checks: Array.from(flagsForm.querySelectorAll("input[name=flag]:checked")).map((i) => i.value),
    model: flagModel.value || "",
    extra: flagExtra.value || "",
  };
  saveFlagsConfig(cfg);
  closeFlagsModal();
  startTerminal(buildFlagsFromConfig(cfg));
});

termToggle.addEventListener("click", () => {
  if (termToggle.hasAttribute("data-running")) stopTerminal();
  else openFlagsModal();
});

// -- Split-pane drag handle ------------------------------------------
const stageEl = $("stage");
const handle = $("split-handle");
const SPLIT_KEY = "loom:split:" + PROJECT_ID;
const savedSplit = localStorage.getItem(SPLIT_KEY);
if (savedSplit) stageEl.style.setProperty("--split", savedSplit);

let dragging = false;
handle.addEventListener("pointerdown", (e) => {
  dragging = true;
  handle.setPointerCapture(e.pointerId);
  handle.classList.add("dragging");
});
handle.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const rect = stageEl.getBoundingClientRect();
  const px = Math.max(240, Math.min(rect.width - 240, e.clientX - rect.left));
  const value = px + "px";
  stageEl.style.setProperty("--split", value);
  localStorage.setItem(SPLIT_KEY, value);
});
handle.addEventListener("pointerup", (e) => {
  dragging = false;
  try { handle.releasePointerCapture(e.pointerId); } catch {}
  handle.classList.remove("dragging");
});
`;
}
