import type { ClaudeSession } from "./runtime.js";

/**
 * Wire a WebSocket connection up to a claude session: forward client
 * input → PTY, send frame snapshots → client on every PTY data tick
 * (debounced by 30ms).
 *
 * Protocol (server → client):
 *   { kind: "frame", frame: TerminalFrame }
 *   { kind: "exit",  code: number | null }
 *
 * Protocol (client → server):
 *   { kind: "input",  data: string }
 *   { kind: "resize", cols: number, rows: number }
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

  // initial frame so the client paints something immediately
  send({ kind: "hello", cols: session.cols, rows: session.rows, pid: session.runtime.ptyHandle.pid });
  send({ kind: "frame", frame: session.screen.getFrame() });

  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function send(message: unknown): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // broken pipe — handled via close event
    }
  }

  function flush(): void {
    timer = null;
    if (!pending) return;
    pending = false;
    send({ kind: "frame", frame: session.screen.getFrame() });
  }

  function schedule(): void {
    pending = true;
    if (timer) return;
    timer = setTimeout(flush, flushMs);
  }

  const unsubFrame = session.onFrame(schedule);
  const unsubExit = session.onExit((code) => {
    send({ kind: "exit", code });
  });

  ws.on("message", (raw) => {
    if (typeof raw !== "string" && !(raw instanceof Buffer)) return;
    const text = typeof raw === "string" ? raw : raw.toString("utf8");
    let msg: { kind?: string; data?: string; cols?: number; rows?: number };
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.kind === "input" && typeof msg.data === "string") {
      session.runtime.ptyHandle.write(msg.data);
    } else if (
      msg.kind === "resize" &&
      typeof msg.cols === "number" &&
      typeof msg.rows === "number"
    ) {
      const cols = Math.max(20, Math.min(500, Math.round(msg.cols)));
      const rows = Math.max(5, Math.min(200, Math.round(msg.rows)));
      session.runtime.ptyHandle.resize(cols, rows);
      session.screen.resize(cols, rows);
      session.cols = cols;
      session.rows = rows;
      // immediately send a frame at the new size
      send({ kind: "frame", frame: session.screen.getFrame() });
    }
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
