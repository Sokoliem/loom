import { startDaemon } from "./daemon.js";
import { runDoctor } from "./doctor/index.js";

const SUBCOMMANDS = ["start", "daemon", "doctor", "help", "version"];

async function main(): Promise<void> {
  const [, , cmd = "help", ...rest] = process.argv;
  switch (cmd) {
    case "start":
    case "daemon": {
      const port = portFromArgs(rest);
      const h = await startDaemon({ port });
      process.stderr.write(`loom daemon listening on ${h.url}\n`);
      process.on("SIGINT", async () => {
        await h.stop();
        process.exit(0);
      });
      process.on("SIGTERM", async () => {
        await h.stop();
        process.exit(0);
      });
      return;
    }
    case "doctor": {
      const result = await runDoctor();
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      process.exit(result.overall === "red" ? 1 : 0);
      return;
    }
    case "version": {
      process.stdout.write("loom v0.9.0\n");
      return;
    }
    case "help":
    default: {
      process.stdout.write(USAGE);
      return;
    }
  }
}

const USAGE = `loom — design workspace for Claude Code

Usage:
  loom start [--port N]    Start the daemon (HTTP + WS)
  loom daemon [--port N]   Alias for 'start'
  loom doctor              Diagnose Node, git, Playwright, project health
  loom version             Print version
  loom help                Show this message

Run the MCP server separately:
  loom-tools               Stdio MCP server (used by Claude Code, Claude Desktop, Codex)

Subcommands available to Claude via the MCP server are listed by 'tools/list'.
`;

function portFromArgs(args: string[]): number | undefined {
  const idx = args.findIndex((a) => a === "--port" || a === "-p");
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  const n = Number.parseInt(args[idx + 1] ?? "", 10);
  return Number.isFinite(n) ? n : undefined;
}

main().catch((err) => {
  process.stderr.write(`loom: ${err.message}\n`);
  process.exit(1);
});
