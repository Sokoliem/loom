import { homedir } from "node:os";
import { join } from "node:path";

export function loomHome(): string {
  return process.env.LOOM_HOME ?? join(homedir(), ".loom");
}

export function serverDir(): string {
  return join(loomHome(), "server");
}

export function serverDbPath(): string {
  return join(serverDir(), "server.sqlite");
}

export function serverPidPath(): string {
  return join(serverDir(), "pid");
}

export function serverPortPath(): string {
  return join(serverDir(), "port");
}

export function projectDbPath(projectDir: string): string {
  return join(projectDir, ".loom", "project.sqlite");
}

export function projectSecretPath(projectDir: string): string {
  return join(projectDir, ".loom", "secret");
}

export function projectManifestPath(projectDir: string): string {
  return join(projectDir, "loom.yaml");
}

export function tokensDir(projectDir: string): string {
  return join(projectDir, "tokens");
}

export function componentsDir(projectDir: string): string {
  return join(projectDir, "components");
}

export function routesDir(projectDir: string): string {
  return join(projectDir, "routes");
}

export function mockDataDir(projectDir: string): string {
  return join(projectDir, "mock-data");
}

export function assetsDir(projectDir: string): string {
  return join(projectDir, "assets");
}

export function exportsDir(projectDir: string): string {
  return join(projectDir, "exports");
}

export function loomCacheDir(projectDir: string): string {
  return join(projectDir, ".loom");
}

export function snapshotsDir(projectDir: string): string {
  return join(loomCacheDir(projectDir), "snapshots");
}

export function forgeDir(projectDir: string): string {
  return join(loomCacheDir(projectDir), "forge");
}

export function validationDir(projectDir: string): string {
  return join(loomCacheDir(projectDir), "validation");
}

export function defaultProjectRoot(): string {
  return process.env.LOOM_PROJECT_ROOT ?? join(homedir(), "loom");
}
