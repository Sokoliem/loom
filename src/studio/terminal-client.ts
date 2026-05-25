/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Loom terminal client — bundled to dist/vendor/terminal.js at build time
 * and served by the daemon under /__loom/vendor/terminal.js. Composes
 * @celestial/rift's browser-side cell-grid renderer with a WebSocket bridge
 * back to the loom daemon's claude PTY session.
 *
 * Server protocol (recap):
 *   incoming:  { kind: "hello",  cols, rows, pid }
 *              { kind: "frame",  frame: TerminalFrame }   (≥1 per data tick)
 *              { kind: "exit",   code }                   (PTY exited)
 *              { kind: "error",  message }
 *   outgoing:  { kind: "input",  data }                   (keystrokes)
 *              { kind: "resize", cols, rows }             (on container resize)
 *
 * Exposed as a small global on window:
 *   window.__loomTerminal({ wsUrl, host, onStatus? })
 *     - host:    HTMLElement to mount the terminal into
 *     - wsUrl:   ws://...:5174/api/loom/terminal/ws?projectId=...
 *     - onStatus optional callback for status transitions
 */

import { createTerminal, injectRiftStyles } from "@celestial/rift";

type StatusKind = "connecting" | "open" | "closed" | "exited" | "error";

interface BootOptions {
  host: HTMLElement;
  wsUrl: string;
  onStatus?: (s: StatusKind, detail?: string) => void;
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

  function connect(): void {
    status("connecting");
    ws = new WebSocket(opts.wsUrl);

    ws.addEventListener("open", () => {
      reconnectAttempt = 0;
      status("open");
      sendResize();
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
            // ignore render errors so the WS keeps streaming
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

  function sendInput(data: string): void {
    send({ kind: "input", data });
  }

  function sendResize(): void {
    const rect = opts.host.getBoundingClientRect();
    // Heuristic: rift draws a fixed character box roughly 9px wide × 18px tall.
    // Could be measured precisely via getComputedStyle, but this is enough to
    // keep claude's output legible at common widths.
    const cols = Math.max(40, Math.floor(rect.width / 9));
    const rows = Math.max(8, Math.floor(rect.height / 18));
    send({ kind: "resize", cols, rows });
  }

  // Keystrokes
  opts.host.tabIndex = 0;
  opts.host.addEventListener("click", () => opts.host.focus());
  opts.host.addEventListener("keydown", (e) => {
    const data = encodeKey(e);
    if (data !== null) {
      e.preventDefault();
      sendInput(data);
    }
  });
  opts.host.addEventListener("paste", (e) => {
    const text = e.clipboardData?.getData("text") ?? "";
    if (text) {
      e.preventDefault();
      sendInput(text);
    }
  });

  // Container resize → notify the daemon
  let resizeRaf = 0;
  const resizeObs = new ResizeObserver(() => {
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

/**
 * Convert a portal `TerminalFrame` into a rift `CellGrid`. Their `Cell` and
 * `StyleAttrs` types are structurally identical so the conversion is mostly
 * a shape change: portal's `{ buffers: { main: { grid: Cell[][] } } }` →
 * rift's `{ cells, width, height }` plus filling undefined cells with spaces.
 */
function portalFrameToRiftGrid(frame: unknown): { cells: unknown[][]; width: number; height: number } | null {
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

/** Translate a KeyboardEvent into the bytes a terminal expects. */
function encodeKey(e: KeyboardEvent): string | null {
  const k = e.key;
  if (k === "Backspace") return "\x7f";
  if (k === "Delete") return "\x1b[3~";
  if (k === "Enter") return "\r";
  if (k === "Tab") return "\t";
  if (k === "Escape") return "\x1b";
  if (k === "ArrowUp") return "\x1b[A";
  if (k === "ArrowDown") return "\x1b[B";
  if (k === "ArrowRight") return "\x1b[C";
  if (k === "ArrowLeft") return "\x1b[D";
  if (k === "Home") return "\x1b[H";
  if (k === "End") return "\x1b[F";
  if (k === "PageUp") return "\x1b[5~";
  if (k === "PageDown") return "\x1b[6~";
  if (k.startsWith("F") && /^F\d{1,2}$/.test(k)) {
    // Function keys — Fn → ESC OP / OQ / ... for F1-F4, ESC[NN~ for F5+
    const n = Number(k.slice(1));
    const map: Record<number, string> = {
      1: "\x1bOP",
      2: "\x1bOQ",
      3: "\x1bOR",
      4: "\x1bOS",
      5: "\x1b[15~",
      6: "\x1b[17~",
      7: "\x1b[18~",
      8: "\x1b[19~",
      9: "\x1b[20~",
      10: "\x1b[21~",
      11: "\x1b[23~",
      12: "\x1b[24~",
    };
    return map[n] ?? null;
  }
  if (e.ctrlKey && k.length === 1) {
    const c = k.toLowerCase().charCodeAt(0);
    if (c >= 97 && c <= 122) return String.fromCharCode(c - 96); // Ctrl-A..Ctrl-Z
    if (k === " ") return "\x00";
  }
  if (k.length === 1 && !e.metaKey && !e.altKey) return k;
  if (e.altKey && k.length === 1) return "\x1b" + k;
  return null;
}
