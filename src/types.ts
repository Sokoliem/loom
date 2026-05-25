/** Core shared types. */

export type LoomError = { code: string; message: string; hint?: string };

export type ProjectId = string;
export type VersionId = string;
export type Theme = string;

export interface ProjectRecord {
  id: ProjectId;
  name: string;
  path: string;
  createdAt: number;
  lastOpenedAt: number | null;
  archived: boolean;
}

export interface ProjectManifest {
  name: string;
  description?: string;
  features?: Record<string, unknown>;
  themes?: string[];
  default_theme?: string;
}

export interface VersionRecord {
  id: VersionId;
  parentId: VersionId | null;
  branch: string;
  label: string | null;
  message: string | null;
  createdAt: number;
  createdBy: "claude" | "user" | "auto" | "forge" | "panel";
  files: Record<string, string>;
}

export interface BranchRecord {
  name: string;
  headVersionId: VersionId;
  createdAt: number;
  protected: boolean;
}

export interface ValidationRun {
  id: string;
  versionId: VersionId;
  routePath: string | null;
  kind: "axe" | "token-lint" | "ds-lint" | "deterministic-lint" | "panel";
  reportJson: string;
  ts: number;
}

export interface ForgeRun {
  id: string;
  routePath: string;
  goal: string;
  iterations: number;
  finalConfidence: number;
  costUsd: number;
  outcome: "running" | "converged" | "max-iter" | "cost-cap" | "aborted";
  worktreePath: string;
  squashCommitSha: string | null;
  ts: number;
}

export interface ReviewThread {
  id: string;
  routePath: string;
  elementSelector: string;
  viewport: string;
  versionId: VersionId;
  status: "open" | "resolved" | "rejected";
  source: "stakeholder" | "panel" | "self";
  createdAt: number;
  resolvedAt: number | null;
  messages: ReviewMessage[];
}

export interface ReviewMessage {
  id: string;
  author: string;
  body: string;
  severity: "low" | "medium" | "high" | null;
  agent: string | null;
  screenshotHash: string | null;
  ts: number;
}

export type ExportTarget =
  | "css-vars"
  | "tailwind"
  | "style-dictionary"
  | "react-shadcn"
  | "storybook-mdx"
  | "route-map-md"
  | "static-bundle";

export interface ExportResult {
  target: ExportTarget;
  outDir: string;
  files: string[];
}

export type Viewport = "desktop" | "tablet" | "mobile" | string;

export interface PanelFinding {
  id: string;
  agent: string;
  severity: "low" | "medium" | "high";
  body: string;
  elementSelector: string | null;
  suggestedFix: string | null;
}

export interface PanelReport {
  ts: number;
  scope: string;
  agents: string[];
  findings: PanelFinding[];
  missingAgents: string[];
  costUsd: number;
  durationMs: number;
}
