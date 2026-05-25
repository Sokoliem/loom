/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Loom terminal client — bundled to dist/vendor/terminal.js at build time
 * and served by the daemon under /__loom/vendor/terminal.js.
 *
 * The browser-side responsibilities are intentionally thin: render the cell
 * grids via `@celestial/rift.createTerminal`, send raw key/mouse/wheel
 * events to the daemon. The daemon owns all PTY-protocol encoding so we
 * can compose `@celestial/lens.normalizeBrowserMirrorKey` +
 * `@celestial/lens.mouseSequence` instead of reimplementing them here.
 *
 * Server protocol (recap):
 *   incoming:  { kind: "hello",  cols, rows, pid }
 *              { kind: "frame",  frame: TerminalFrame }
 *              { kind: "exit",   code }
 *              { kind: "error",  message }
 *   outgoing:  { kind: "key",    key, modifiers: { ctrl, alt, shift } }
 *              { kind: "mouse",  type: 'click'|'down'|'up'|'move',
 *                                button, row, col, modifiers }
 *              { kind: "wheel",  direction: 'up'|'down', row, col, modifiers }
 *              { kind: "resize", cols, rows }
 *              { kind: "paste",  data }
 *
 * Exposed as a small global on window:
 *   window.__loomTerminal({ wsUrl, host, onStatus? })
 */

import { createTerminal, injectRiftStyles } from "@celestial/rift";

type StatusKind = "connecting" | "open" | "closed" | "exited" | "error";

interface BootOptions {
  host: HTMLElement;
  wsUrl: string;
  onStatus?: (s: StatusKind, detail?: string) => void;
}

interface CellMetrics {
  cellWidth: number;
  cellHeight: number;
}

declare global {
  interface Window {
    __loomTerminal?: (opts: BootOptions) => () => void;
  }
}

window.__loomTerminal = (opts: BootOptions) => {
  injectRiftStyles();
  const term = createTerminal(opts.host);
  const status = (s: StatusKind, detail?: string) => opts.onStatus?.(s, detail);

  let ws: WebSocket | null = null;
  let alive = true;
  let reconnectAttempt = 0;
  let cellMetrics: CellMetrics | null = null;

  function connect(): void {
    status("connecting");
    ws = new WebSocket(opts.wsUrl);

    ws.addEventListener("open", async () => {
      reconnectAttempt = 0;
      status("open");
      // Wait for rift's font (Geist Mono) to actually load before measuring —
      // otherwise the first sendResize uses fallback-font metrics and the
      // PTY ends up at a too-narrow column count.
      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          /* noop */
        }
      }
      cellMetrics = null;
      sendResize();
      // Belt-and-suspenders: re-measure once after layout has settled. Some
      // browsers report 0×0 for the .rift-terminal element until it has been
      // painted at least once.
      setTimeout(() => {
        cellMetrics = null;
        sendResize();
      }, 250);
    });
    ws.addEventListener("message", (ev) => {
      let msg: { kind?: string; frame?: unknown; code?: number; message?: string };
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : "{}");
      } catch {
        return;
      }
      if (msg.kind === "frame" && msg.frame && typeof msg.frame === "object") {
        const grid = portalFrameToRiftGrid(msg.frame);
        if (grid) {
          try {
            term.write(grid as never);
          } catch {
            // ignore render errors; WS keeps streaming
          }
        }
      } else if (msg.kind === "exit") {
        status("exited", String(msg.code ?? "?"));
      } else if (msg.kind === "error") {
        status("error", msg.message ?? "");
      }
    });
    ws.addEventListener("close", () => {
      status("closed");
      if (!alive) return;
      const delay = Math.min(8000, 500 * 2 ** reconnectAttempt++);
      setTimeout(connect, delay);
    });
    ws.addEventListener("error", () => {
      status("error", "ws error");
    });
  }

  function send(message: object): void {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function measureCell(): CellMetrics {
    // Rift styles cells with `width:Nch` where N is column count, so a single
    // span's width can be 2× when it holds a wide glyph. The only reliable
    // way to get a single-cell width is to render our own probe inside the
    // .rift-terminal element so it inherits rift's font-family / font-size /
    // line-height, then measure a known 1-char monospace string.
    const riftEl = opts.host.querySelector<HTMLElement>(".rift-terminal");
    const container = riftEl ?? opts.host;
    const probe = document.createElement("span");
    probe.textContent = "M".repeat(80);
    probe.style.cssText =
      "position:absolute;visibility:hidden;white-space:pre;pointer-events:none;left:0;top:0";
    container.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(container).lineHeight);
    container.removeChild(probe);
    const cellWidth = Math.max(1, rect.width / 80);
    const cellHeight = Math.max(
      1,
      Number.isFinite(lineHeight) ? lineHeight : rect.height,
    );
    return { cellWidth, cellHeight };
  }

  function pointToCell(clientX: number, clientY: number): { row: number; col: number } {
    if (!cellMetrics) cellMetrics = measureCell();
    const rect = opts.host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top + opts.host.scrollTop;
    const col = Math.max(0, Math.floor(x / cellMetrics.cellWidth));
    const row = Math.max(0, Math.floor(y / cellMetrics.cellHeight));
    return { row, col };
  }

  function modifiersOf(e: KeyboardEvent | MouseEvent | WheelEvent): {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
  } {
    return {
      ctrl: e.ctrlKey || e.metaKey,
      alt: e.altKey,
      shift: e.shiftKey,
    };
  }

  function sendResize(): void {
    if (!cellMetrics) cellMetrics = measureCell();
    const rect = opts.host.getBoundingClientRect();
    const cols = Math.max(40, Math.floor(rect.width / cellMetrics.cellWidth));
    const rows = Math.max(8, Math.floor(rect.height / cellMetrics.cellHeight));
    send({ kind: "resize", cols, rows });
  }

  // Focus + keystrokes
  opts.host.tabIndex = 0;
  opts.host.style.cursor = "text";
  opts.host.addEventListener("pointerdown", () => opts.host.focus());
  opts.host.addEventListener("keydown", (e) => {
    if (isBrowserReservedShortcut(e)) return;
    // Some keystrokes are pure-modifier or pure-IME; let the server decide via
    // normalizeBrowserMirrorKey, but skip the obvious no-ops to avoid spam.
    if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
    e.preventDefault();
    send({ kind: "key", key: e.key, modifiers: modifiersOf(e) });
  });

  // Paste
  opts.host.addEventListener("paste", (e) => {
    const text = e.clipboardData?.getData("text") ?? "";
    if (text) {
      e.preventDefault();
      send({ kind: "paste", data: text });
    }
  });

  // Mouse — only forwarded to PTY when in mouse-tracking mode; the server
  // does the gating because it knows the mode (from frame.capabilities).
  // We always send; the server drops them if mouse-tracking is off.
  opts.host.addEventListener("mousedown", (e) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    const { row, col } = pointToCell(e.clientX, e.clientY);
    send({
      kind: "mouse",
      type: "down",
      button: ["left", "middle", "right"][e.button] ?? "left",
      row,
      col,
      modifiers: modifiersOf(e),
    });
  });
  opts.host.addEventListener("mouseup", (e) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    const { row, col } = pointToCell(e.clientX, e.clientY);
    send({
      kind: "mouse",
      type: "up",
      button: ["left", "middle", "right"][e.button] ?? "left",
      row,
      col,
      modifiers: modifiersOf(e),
    });
  });
  opts.host.addEventListener("click", (e) => {
    const { row, col } = pointToCell(e.clientX, e.clientY);
    send({
      kind: "mouse",
      type: "click",
      button: "left",
      row,
      col,
      modifiers: modifiersOf(e),
    });
  });

  // Wheel — always send to server. Server checks mouse-tracking and either
  // forwards as scroll-mouse-sequence or pans its own scrollback view.
  opts.host.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const { row, col } = pointToCell(e.clientX, e.clientY);
      // Trackpads send small deltas — collapse to discrete direction.
      const direction = e.deltaY > 0 ? "down" : "up";
      send({
        kind: "wheel",
        direction,
        row,
        col,
        modifiers: modifiersOf(e),
      });
    },
    { passive: false },
  );

  // Container resize → notify the daemon
  let resizeRaf = 0;
  const resizeObs = new ResizeObserver(() => {
    cellMetrics = null; // re-measure after layout changes
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(sendResize);
  });
  resizeObs.observe(opts.host);

  connect();

  return () => {
    alive = false;
    resizeObs.disconnect();
    try {
      ws?.close();
    } catch {
      /* noop */
    }
    try {
      term.destroy();
    } catch {
      /* noop */
    }
  };
};

/** Browser shortcuts the OS / browser owns — don't intercept these. */
function isBrowserReservedShortcut(e: KeyboardEvent): boolean {
  if (e.key === "F5" || e.key === "F11" || e.key === "F12") return true;
  if ((e.ctrlKey || e.metaKey) && e.key === "Tab") return true;
  if (e.altKey && e.key === "F4") return true;
  if (e.ctrlKey || e.metaKey) {
    const k = (e.key || "").toLowerCase();
    // browser-owned chord keys (new tab, close, reload, find, address bar, etc.)
    if (/^[twnrlfjh]$/.test(k)) return true;
    if (/^[0=\-+]$/.test(k)) return true;
  }
  return false;
}

/**
 * Convert a portal `TerminalFrame` into a rift `CellGrid`. Their `Cell` and
 * `StyleAttrs` types are structurally identical — see frame.ts in portal and
 * types.ts in rift — so the conversion is mostly a shape change.
 */
function portalFrameToRiftGrid(
  frame: unknown,
): { cells: unknown[][]; width: number; height: number } | null {
  if (!frame || typeof frame !== "object") return null;
  const f = frame as {
    activeBuffer?: "main" | "alternate";
    buffers?: {
      main?: { grid?: (object | undefined)[][] };
      alternate?: { grid?: (object | undefined)[][] };
    };
  };
  const bufferName = f.activeBuffer === "alternate" ? "alternate" : "main";
  const buffer = f.buffers?.[bufferName] ?? f.buffers?.main;
  if (!buffer?.grid || !Array.isArray(buffer.grid)) return null;
  const grid = buffer.grid;
  const height = grid.length;
  const width = grid.reduce((m, row) => Math.max(m, row.length), 0);
  const empty = { char: " ", style: {} };
  const cells = grid.map((row) => {
    const out: unknown[] = [];
    for (let i = 0; i < width; i++) out.push(row[i] ?? empty);
    return out;
  });
  return { cells, width, height };
}
