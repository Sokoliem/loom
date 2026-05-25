import { execFileNoThrow } from "../utils/execFileNoThrow.js";
import { projectCurrent } from "../core/project.js";

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

  // Project health
  const cur = projectCurrent();
  checks.push({
    name: "current-project",
    status: cur ? "green" : "yellow",
    message: cur ? `${cur.name} (${cur.path})` : "no project open — run project_create or project_open",
  });

  const overall = aggregate(checks);
  return { overall, checks };
}

function aggregate(checks: DoctorCheck[]): "green" | "yellow" | "red" {
  if (checks.some((c) => c.status === "red")) return "red";
  if (checks.some((c) => c.status === "yellow")) return "yellow";
  return "green";
}
