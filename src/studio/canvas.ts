/**
 * Canvas viewport — multi-route pan/zoom workspace (v0.11).
 *
 * The chrome adds a "Canvas" option to the viewport picker. When selected, the
 * existing `.preview-pane` is hidden and a `.loom-canvas` container fills the
 * stage: one iframe per route, laid out in a grid by default, draggable per-
 * frame, with wheel-zoom + space-drag pan on the surface itself. Positions
 * persist to `.loom/canvas.json` (one entry per route path).
 *
 * Keeping the implementation in its own module (similar to panels.ts) so the
 * chrome.ts inline script stays focused on the single-iframe path.
 */

export interface CanvasContext {
  projectId: string;
  vitePort: number;
  daemonSecret: string;
}

export function canvasBlocks(ctx: CanvasContext): {
  shell: string;
  css: string;
  script: string;
} {
  return {
    shell: SHELL,
    css: CANVAS_CSS,
    script: canvasScript(ctx),
  };
}

const SHELL = `
<section class="loom-canvas" id="loom-canvas" hidden aria-label="Multi-route canvas">
  <div class="loom-canvas-stage" id="loom-canvas-stage">
    <div class="loom-canvas-empty" id="loom-canvas-empty">No routes yet — generate some with claude.</div>
  </div>
  <div class="loom-canvas-toolbar">
    <button type="button" class="loom-canvas-btn" data-action="auto-layout" title="Auto layout">⊞ Auto layout</button>
    <button type="button" class="loom-canvas-btn" data-action="reset-view" title="Reset view (1×)">⊙ Reset</button>
    <span class="loom-canvas-hint">Space + drag · Wheel zooms · Drag titlebar to move</span>
  </div>
</section>
`;

const CANVAS_CSS = `
.loom-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(circle, oklch(0.25 0.005 270) 1px, transparent 1px) 0 0 / 24px 24px,
    var(--stage-bg, oklch(0.18 0.005 270));
  user-select: none;
  cursor: grab;
}
.loom-canvas[data-panning="1"] { cursor: grabbing; }
.loom-canvas[hidden] { display: none; }
.loom-canvas-stage {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  will-change: transform;
}
.loom-canvas-empty {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  color: var(--chrome-muted, #888);
  font: 13px ui-monospace, monospace;
  pointer-events: none;
}
.loom-canvas-frame {
  position: absolute;
  background: white;
  border: 1px solid var(--chrome-border, #20232a);
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 16px 32px -16px rgba(0,0,0,0.35);
  overflow: hidden;
  display: flex; flex-direction: column;
}
.loom-canvas-frame-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: oklch(0.13 0.01 270);
  color: var(--chrome-text, #e6e8eb);
  border-bottom: 1px solid var(--chrome-border, #20232a);
  font: 600 11px -apple-system, "Segoe UI", system-ui, sans-serif;
  cursor: grab;
  user-select: none;
}
.loom-canvas-frame-bar[data-dragging="1"] { cursor: grabbing; }
.loom-canvas-frame-bar code {
  flex: 1;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.loom-canvas-frame-actions { display: flex; gap: 4px; }
.loom-canvas-frame-btn {
  background: transparent;
  border: 1px solid var(--chrome-border, #20232a);
  color: var(--chrome-muted, #888);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 10px;
  cursor: pointer;
}
.loom-canvas-frame-btn:hover { color: var(--chrome-text, #e6e8eb); border-color: var(--chrome-accent, #f59462); }
.loom-canvas-frame iframe { flex: 1; width: 100%; border: 0; background: white; }
.loom-canvas-toolbar {
  position: absolute;
  left: 12px; bottom: 12px;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: rgba(15, 17, 21, 0.85);
  border: 1px solid var(--chrome-border, #20232a);
  border-radius: 8px;
  backdrop-filter: blur(6px);
  z-index: 10;
}
.loom-canvas-btn {
  background: transparent; border: 1px solid var(--chrome-border, #20232a);
  color: var(--chrome-text, #e6e8eb);
  padding: 3px 8px; border-radius: 5px;
  font: 600 11px -apple-system, "Segoe UI", system-ui, sans-serif;
  cursor: pointer;
}
.loom-canvas-btn:hover { border-color: var(--chrome-accent, #f59462); color: var(--chrome-accent, #f59462); }
.loom-canvas-hint {
  color: var(--chrome-muted, #888);
  font: 10.5px ui-monospace, monospace;
}
`;

function canvasScript(ctx: CanvasContext): string {
  return `
(function() {
  const PROJECT_ID = ${JSON.stringify(ctx.projectId)};
  const VITE_ORIGIN = ${JSON.stringify(`http://127.0.0.1:${ctx.vitePort}`)};
  const SECRET = ${JSON.stringify(ctx.daemonSecret)};
  const hdrs = { "content-type": "application/json", "x-loom-secret": SECRET };
  const FRAME_W = 1280;
  const FRAME_H = 800;
  const GUTTER = 80;
  const TITLE_BAR = 28;

  const canvas = document.getElementById("loom-canvas");
  const stage = document.getElementById("loom-canvas-stage");
  const emptyEl = document.getElementById("loom-canvas-empty");
  if (!canvas || !stage) return;

  const view = { x: 0, y: 0, scale: 0.25 };
  const positions = {}; // route → { x, y }
  let booted = false;
  let frameNodes = new Map();

  function applyView() {
    stage.style.transform = "translate(" + view.x + "px, " + view.y + "px) scale(" + view.scale + ")";
  }

  function autoLayout(paths) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(paths.length)));
    paths.forEach((p, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions[p] = {
        x: col * (FRAME_W + GUTTER),
        y: row * (FRAME_H + TITLE_BAR + GUTTER),
      };
    });
    persistCanvas();
  }

  let persistTimer = null;
  function persistCanvas() {
    // Debounced: wheel-zoom and rapid pan fire 60+ Hz. Without this each event
    // would PUT canvas.json synchronously, racing the writes and risking
    // partial reads. 250 ms trailing balances responsiveness against churn.
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      fetch("/api/loom/projects/" + PROJECT_ID + "/canvas", {
        method: "PUT",
        headers: hdrs,
        body: JSON.stringify({ positions, view }),
      }).catch(() => { /* ignore — best-effort persistence */ });
    }, 250);
  }

  function makeFrame(path) {
    const frame = document.createElement("div");
    frame.className = "loom-canvas-frame";
    frame.dataset.route = path;
    frame.style.width = FRAME_W + "px";
    frame.style.height = (FRAME_H + TITLE_BAR) + "px";

    const bar = document.createElement("div");
    bar.className = "loom-canvas-frame-bar";
    const code = document.createElement("code");
    code.textContent = path;
    bar.appendChild(code);

    const actions = document.createElement("div");
    actions.className = "loom-canvas-frame-actions";
    const openBtn = document.createElement("button");
    openBtn.type = "button"; openBtn.className = "loom-canvas-frame-btn";
    openBtn.textContent = "Open"; openBtn.title = "Open this route in the single-iframe stage";
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const picker = document.getElementById("viewport-picker");
      const routePicker = document.getElementById("route-picker");
      if (routePicker) { routePicker.value = path; routePicker.dispatchEvent(new Event("change")); }
      if (picker) { picker.value = "fit"; picker.dispatchEvent(new Event("change")); }
    });
    const shotBtn = document.createElement("button");
    shotBtn.type = "button"; shotBtn.className = "loom-canvas-frame-btn";
    shotBtn.textContent = "📸"; shotBtn.title = "Screenshot this route";
    shotBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      shotBtn.disabled = true;
      try {
        const r = await fetch("/api/loom/screenshot", {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify({ projectId: PROJECT_ID, path, viewport: "desktop", theme: "light" }),
        });
        const j = await r.json();
        if (!r.ok || j.ok === false) {
          alert("Screenshot failed: " + (j.reason || j.error || "unknown"));
        }
      } catch (err) {
        alert("Screenshot error: " + err.message);
      } finally {
        shotBtn.disabled = false;
      }
    });
    actions.appendChild(openBtn);
    actions.appendChild(shotBtn);
    bar.appendChild(actions);

    const iframe = document.createElement("iframe");
    iframe.src = VITE_ORIGIN + "/?route=" + encodeURIComponent(path) + "&theme=light";
    iframe.loading = "lazy";

    frame.appendChild(bar);
    frame.appendChild(iframe);

    // Per-frame drag via the title bar.
    let dragging = false;
    let startX = 0, startY = 0, originX = 0, originY = 0;
    bar.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      bar.setAttribute("data-dragging", "1");
      bar.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      const pos = positions[path] || { x: 0, y: 0 };
      originX = pos.x; originY = pos.y;
    });
    bar.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = (e.clientX - startX) / view.scale;
      const dy = (e.clientY - startY) / view.scale;
      const next = { x: originX + dx, y: originY + dy };
      positions[path] = next;
      frame.style.left = next.x + "px";
      frame.style.top = next.y + "px";
    });
    bar.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      bar.removeAttribute("data-dragging");
      try { bar.releasePointerCapture(e.pointerId); } catch {}
      persistCanvas();
    });

    return frame;
  }

  function renderFrames(paths) {
    frameNodes.forEach((node) => node.remove());
    frameNodes = new Map();
    if (paths.length === 0) { emptyEl.hidden = false; return; }
    emptyEl.hidden = true;
    for (const p of paths) {
      const pos = positions[p] || { x: 0, y: 0 };
      const node = makeFrame(p);
      node.style.left = pos.x + "px";
      node.style.top = pos.y + "px";
      stage.appendChild(node);
      frameNodes.set(p, node);
    }
  }

  async function fetchRoutes() {
    const r = await fetch("/api/loom/projects/" + PROJECT_ID + "/routes");
    if (!r.ok) return [];
    const j = await r.json();
    return (j.routes || []).map((rt) => rt.path).sort();
  }

  async function loadCanvas() {
    try {
      const r = await fetch("/api/loom/projects/" + PROJECT_ID + "/canvas");
      if (r.ok) {
        const j = await r.json();
        if (j.positions) Object.assign(positions, j.positions);
        if (j.view) Object.assign(view, j.view);
      }
    } catch { /* ignore — fall through to auto layout */ }
  }

  async function activate() {
    if (booted) return;
    booted = true;
    await loadCanvas();
    const paths = await fetchRoutes();
    // Any route lacking a persisted position → run a fresh auto layout.
    const missing = paths.filter((p) => !positions[p]);
    if (missing.length > 0 && Object.keys(positions).length === 0) {
      autoLayout(paths);
    } else if (missing.length > 0) {
      // Append new routes to the next free row.
      const existing = Object.keys(positions).length;
      missing.forEach((p, i) => {
        const idx = existing + i;
        const cols = Math.max(1, Math.ceil(Math.sqrt(paths.length)));
        positions[p] = {
          x: (idx % cols) * (FRAME_W + GUTTER),
          y: Math.floor(idx / cols) * (FRAME_H + TITLE_BAR + GUTTER),
        };
      });
      persistCanvas();
    }
    applyView();
    renderFrames(paths);
  }

  // Public on/off API used by the chrome viewport picker.
  window.__loomCanvas = {
    show: () => { canvas.hidden = false; activate(); },
    hide: () => { canvas.hidden = true; },
    refresh: async () => {
      const paths = await fetchRoutes();
      renderFrames(paths);
    },
  };

  // Wheel-zoom (centered on pointer in stage coords).
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const sx = (px - view.x) / view.scale;
    const sy = (py - view.y) / view.scale;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const nextScale = Math.max(0.05, Math.min(2, view.scale * factor));
    view.x = px - sx * nextScale;
    view.y = py - sy * nextScale;
    view.scale = nextScale;
    applyView();
    persistCanvas();
  }, { passive: false });

  // Space + drag pan, OR middle-mouse drag pan.
  let spaceHeld = false;
  let panning = false;
  let panStart = { x: 0, y: 0, vx: 0, vy: 0 };
  // Gate on canvas visibility AND non-editable target so the space bar in a
  // token-edit input or the project header contenteditable doesn't toggle
  // the pan cursor. (The token-edit input is in the chrome, not the canvas,
  // but our listener is on window.)
  function isEditableTarget(target) {
    if (!(target instanceof Element)) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return target.closest('[contenteditable="true"]') != null;
  }
  window.addEventListener("keydown", (e) => {
    if (canvas.hidden) return;
    if (isEditableTarget(e.target)) return;
    if (e.key === " ") { spaceHeld = true; e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => { if (e.key === " ") spaceHeld = false; });
  canvas.addEventListener("pointerdown", (e) => {
    const isPanGesture = (spaceHeld && e.button === 0) || e.button === 1;
    if (!isPanGesture) return;
    e.preventDefault();
    panning = true;
    canvas.dataset.panning = "1";
    canvas.setPointerCapture(e.pointerId);
    panStart = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!panning) return;
    view.x = panStart.vx + (e.clientX - panStart.x);
    view.y = panStart.vy + (e.clientY - panStart.y);
    applyView();
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!panning) return;
    panning = false;
    delete canvas.dataset.panning;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    persistCanvas();
  });

  // Toolbar buttons.
  document.querySelectorAll(".loom-canvas-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.action === "auto-layout") {
        const paths = await fetchRoutes();
        autoLayout(paths);
        renderFrames(paths);
      } else if (btn.dataset.action === "reset-view") {
        view.x = 0; view.y = 0; view.scale = 0.25;
        applyView(); persistCanvas();
      }
    });
  });

  // Routes refreshed elsewhere → re-render canvas if it's visible.
  window.addEventListener("loom:routes-refreshed", () => {
    if (!canvas.hidden) window.__loomCanvas.refresh();
  });
})();
`;
}
