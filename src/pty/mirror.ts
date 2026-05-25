import {
  mouseSequence,
  normalizeBrowserMirrorKey,
  type KeyModifiers,
} from "@celestial/lens";
import { keyToBuffer } from "@celestial/telescope";
import type { ClaudeSession } from "./runtime.js";

/**
 * Wire a WebSocket up to a claude session. The client sends RAW key / mouse /
 * wheel events; this module composes Celestial's lens primitives to encode
 * them into PTY bytes:
 *
 *   key   → `lens.normalizeBrowserMirrorKey(key, mods)`     → PTY stdin
 *   mouse → `lens.mouseSequence({ type, button, row, col })` (when PTY's
 *           mouseTracking mode is on)                        → PTY stdin
 *   wheel → if mouseTracking on: mouseSequence(type='scroll', direction…)
 *           else: pan the mirror's own scrollback via
 *           `PtyScreenBuffer.getScrolledFrame(offset)` and re-emit the frame.
 *
 * Frames are pushed at most every 30ms while the PTY emits new data, plus
 * once on attach and once when the scroll offset changes.
 */
export interface MirrorWs {
  send: (data: string) => void;
  on: (event: "message" | "close", cb: (data?: unknown) => void) => void;
}

export interface AttachOptions {
  flushIntervalMs?: number;
}

export function attachMirror(
  session: ClaudeSession,
  ws: MirrorWs,
  opts: AttachOptions = {},
): () => void {
  const flushMs = opts.flushIntervalMs ?? 30;

  function send(message: unknown): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // broken pipe — handled via close event
    }
  }

  function emitFrame(): void {
    send({ kind: "frame", frame: session.getCurrentFrame() });
  }

  // Initial frame for an instant paint.
  send({ kind: "hello", cols: session.cols, rows: session.rows, pid: session.runtime.ptyHandle.pid });
  emitFrame();

  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    timer = null;
    if (!pending) return;
    pending = false;
    emitFrame();
  }

  function schedule(): void {
    pending = true;
    if (timer) return;
    timer = setTimeout(flush, flushMs);
  }

  const unsubFrame = session.onFrame(() => {
    // When new PTY output arrives and the user was scrolled back, snap to
    // tail — matches the behavior most terminal mirrors have (scrolling on
    // new output is jarring; the user just typed something or claude is
    // streaming an answer they want to see).
    if (session.scrollOffset > 0) session.scrollOffset = 0;
    schedule();
  });
  const unsubExit = session.onExit((code) => {
    send({ kind: "exit", code });
  });

  ws.on("message", (raw) => {
    if (typeof raw !== "string" && !(raw instanceof Buffer)) return;
    const text = typeof raw === "string" ? raw : raw.toString("utf8");
    let msg: ClientMsg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    handleClientMessage(session, msg, emitFrame);
  });

  ws.on("close", () => {
    if (timer) clearTimeout(timer);
    unsubFrame();
    unsubExit();
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubFrame();
    unsubExit();
  };
}

interface ClientMsg {
  kind?: string;
  // key
  key?: string;
  modifiers?: KeyModifiers;
  // mouse
  type?: "click" | "down" | "up" | "move" | "scroll";
  button?: "left" | "right" | "middle";
  row?: number;
  col?: number;
  // wheel
  direction?: "up" | "down";
  // resize
  cols?: number;
  rows?: number;
  // paste
  data?: string;
}

function handleClientMessage(
  session: ClaudeSession,
  msg: ClientMsg,
  emitFrame: () => void,
): void {
  const pty = session.runtime.ptyHandle;
  const frame = session.screen.getFrame();
  const mouseTracking = frame.capabilities.mouseTracking;

  switch (msg.kind) {
    case "key": {
      if (typeof msg.key !== "string") return;
      // Two-step compose: lens normalizes the browser key name (e.g.
      // "Enter" → "enter", "ArrowUp" → "up"), then telescope's keyToBuffer
      // encodes that normalized name into the actual terminal byte sequence
      // (e.g. "enter" → "\r", "up" → "\x1b[A"). Single-char printable keys
      // round-trip unchanged.
      const normalized = normalizeBrowserMirrorKey(msg.key, msg.modifiers ?? {});
      if (!normalized) return;
      const buf = keyToBuffer(normalized, msg.modifiers ?? {});
      if (buf && buf.length > 0) pty.write(buf.toString("utf8"));
      return;
    }
    case "paste": {
      if (typeof msg.data === "string" && msg.data.length > 0) pty.write(msg.data);
      return;
    }
    case "mouse": {
      if (!mouseTracking) return; // PTY isn't listening; ignore
      if (typeof msg.row !== "number" || typeof msg.col !== "number") return;
      const type = msg.type;
      if (type !== "click" && type !== "down" && type !== "up" && type !== "move") return;
      const seq = mouseSequence({
        type,
        row: msg.row,
        col: msg.col,
        button: msg.button ?? "left",
        modifiers: msg.modifiers,
      });
      if (seq) pty.write(seq);
      return;
    }
    case "wheel": {
      if (msg.direction !== "up" && msg.direction !== "down") return;
      if (typeof msg.row !== "number" || typeof msg.col !== "number") return;
      if (mouseTracking) {
        // Forward to PTY — apps in mouse-tracking mode (e.g. less, vim,
        // pagers) expect to handle scroll themselves.
        const seq = mouseSequence({
          type: "scroll",
          row: msg.row,
          col: msg.col,
          direction: msg.direction,
          modifiers: msg.modifiers,
        });
        if (seq) pty.write(seq);
      } else {
        // Pan the mirror's own scrollback view. Avoid going past the
        // available scrollback or below 0; emit a new frame each step.
        const step = 3;
        const before = session.scrollOffset;
        const max = session.screen.getScrollbackLength();
        session.scrollOffset =
          msg.direction === "up"
            ? Math.min(max, before + step)
            : Math.max(0, before - step);
        if (session.scrollOffset !== before) emitFrame();
      }
      return;
    }
    case "resize": {
      if (typeof msg.cols !== "number" || typeof msg.rows !== "number") return;
      const cols = Math.max(20, Math.min(500, Math.round(msg.cols)));
      const rows = Math.max(5, Math.min(200, Math.round(msg.rows)));
      pty.resize(cols, rows);
      session.screen.resize(cols, rows);
      session.cols = cols;
      session.rows = rows;
      emitFrame();
      return;
    }
    // legacy "input" — still supported for backward compatibility
    case "input": {
      if (typeof msg.data === "string") pty.write(msg.data);
      return;
    }
  }
}
