import { execFileNoThrow } from "../utils/execFileNoThrow.js";
import { projectCurrent } from "../core/project.js";
import { readDaemonStatus } from "../mcp/daemon-control.js";

export interface DoctorCheck {
  name: string;
  status: "green" | "yellow" | "red";
  message: string;
  hint?: string;
}

export async function runDoctor(): Promise<{ overall: "green" | "yellow" | "red"; checks: DoctorCheck[] }> {
  const checks: DoctorCheck[] = [];

  // Node version
  const nodeMajor = Number.parseInt(process.version.replace(/^v/, "").split(".")[0] ?? "0", 10);
  checks.push({
    name: "node-version",
    status: nodeMajor >= 22 ? "green" : "red",
    message: `node ${process.version} (need ≥ 22)`,
  });

  // git
  const git = await execFileNoThrow("git", ["--version"]);
  checks.push({
    name: "git",
    status: git.code === 0 ? "green" : "red",
    message: git.code === 0 ? git.stdout.trim() : "git not found",
    hint: git.code === 0 ? undefined : "install git from https://git-scm.com",
  });

  // Playwright (optional)
  let playwrightStatus: DoctorCheck["status"] = "yellow";
  let playwrightMessage = "playwright not installed (optional; needed for axe + forge)";
  try {
    await import("playwright");
    playwrightStatus = "green";
    playwrightMessage = "playwright present";
  } catch {
    // soft yellow
  }
  checks.push({
    name: "playwright",
    status: playwrightStatus,
    message: playwrightMessage,
    hint:
      playwrightStatus === "yellow"
        ? "pnpm add -D playwright axe-core && pnpm exec playwright install chromium"
        : undefined,
  });

  // axe-core (optional)
  let axeStatus: DoctorCheck["status"] = "yellow";
  let axeMessage = "axe-core not installed (optional; needed for a11y validation)";
  try {
    await import("axe-core");
    axeStatus = "green";
    axeMessage = "axe-core present";
  } catch {
    // soft yellow
  }
  checks.push({ name: "axe-core", status: axeStatus, message: axeMessage });

  // Vite (required for studio preview as of 0.9.2)
  let viteStatus: DoctorCheck["status"] = "red";
  let viteMessage = "vite not installed — studio preview will not work";
  let viteHint: string | undefined = "the plugin's first-run bootstrap should have installed it; try reinstalling the plugin";
  try {
    const mod: { version?: string } = await import("vite");
    viteStatus = "green";
    viteMessage = `vite present${mod.version ? ` (${mod.version})` : ""}`;
    viteHint = undefined;
  } catch {
    // red — studio depends on vite
  }
  checks.push({ name: "vite", status: viteStatus, message: viteMessage, hint: viteHint });

  // React + plugin-react (required by studio runtime)
  let reactStatus: DoctorCheck["status"] = "red";
  let reactMessage = "react / @vitejs/plugin-react missing — studio preview will not render";
  try {
    await import("react");
    await import("@vitejs/plugin-react");
    reactStatus = "green";
    reactMessage = "react + @vitejs/plugin-react present";
  } catch {
    // red
  }
  checks.push({ name: "react", status: reactStatus, message: reactMessage });

  // better-sqlite3 native binding (required for project metadata)
  let sqliteStatus: DoctorCheck["status"] = "red";
  let sqliteMessage = "better-sqlite3 native binding missing — project DB will not open";
  try {
    await import("better-sqlite3");
    sqliteStatus = "green";
    sqliteMessage = "better-sqlite3 binding present";
  } catch (err) {
    sqliteMessage = `better-sqlite3 load failed: ${(err as Error).message}`;
  }
  checks.push({ name: "better-sqlite3", status: sqliteStatus, message: sqliteMessage });

  // Project health
  const cur = projectCurrent();
  checks.push({
    name: "current-project",
    status: cur ? "green" : "yellow",
    message: cur ? `${cur.name} (${cur.path})` : "no project open — run project_create or project_open",
  });

  // Daemon status
  const daemon = readDaemonStatus();
  checks.push({
    name: "daemon",
    status: daemon.running ? "green" : "yellow",
    message: daemon.running
      ? `daemon running pid=${daemon.pid} url=${daemon.url}`
      : "daemon not running — call daemon_start or run /loom:start",
  });

  // Celestial substrate — loom composes @celestial/forge for the claude PTY,
  // @celestial/lens for the screen buffer, and @celestial/rift for the
  // browser-side renderer. All three must resolve.
  const celestial = [
    { name: "@celestial/forge", hint: "PTY + claude session lifecycle" },
    { name: "@celestial/lens", hint: "server-side screen buffer" },
    { name: "@celestial/rift", hint: "browser-side terminal renderer" },
    { name: "@celestial/beacon-browser", hint: "browser extension chunks" },
  ];
  for (const c of celestial) {
    let ok = false;
    let detail = "";
    try {
      // dynamic import keeps tsc from inlining the resolution
      const mod = await import(/* @vite-ignore */ c.name);
      ok = !!mod;
      detail = "present";
    } catch (err) {
      detail = (err as Error).message.split("\n")[0] ?? "load failed";
    }
    checks.push({
      name: c.name,
      status: ok ? "green" : "red",
      message: ok ? `${c.hint} — ${detail}` : `${c.hint} — ${detail}`,
      hint: ok ? undefined : "ensure the Celestial worktree at C:/Development/celestial/.worktrees/claude-wrapper-rewire/ is built and linked",
    });
  }

  // Claude CLI — needed for the terminal pane (forge.createClaudeRuntime spawns it).
  const claude = await execFileNoThrow("claude", ["--version"]);
  checks.push({
    name: "claude",
    status: claude.code === 0 ? "green" : "yellow",
    message: claude.code === 0 ? claude.stdout.trim() : "claude CLI not found (terminal pane will fail without it)",
    hint: claude.code === 0 ? undefined : "install Claude Code from https://claude.com/code",
  });

  const overall = aggregate(checks);
  return { overall, checks };
}

function aggregate(checks: DoctorCheck[]): "green" | "yellow" | "red" {
  if (checks.some((c) => c.status === "red")) return "red";
  if (checks.some((c) => c.status === "yellow")) return "yellow";
  return "green";
}
