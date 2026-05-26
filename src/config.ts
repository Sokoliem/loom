/**
 * Runtime configuration sourced from process env. Read once at module load —
 * callers should `import { config } from "./config.js"` rather than re-reading
 * `process.env` so that tests can stub via mocking the module.
 *
 * Feature flags follow the convention `LOOM_FEATURE_<NAME>=1` (default off).
 */

function flag(name: string): boolean {
  return process.env[name] === "1";
}

export const config = {
  /** Project-management chrome (v0.10.0). Gates new daemon routes + new chrome panels. */
  featureProjectMgmt: flag("LOOM_FEATURE_PROJECT_MGMT"),
  /** Local-only JSONL telemetry append to ~/.loom/telemetry.jsonl. */
  telemetry: flag("LOOM_TELEMETRY"),
};
