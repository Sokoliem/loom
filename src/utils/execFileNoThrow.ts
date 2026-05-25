import { execFile } from "node:child_process";

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** execFile wrapper: no shell, no throw, returns {code, stdout, stderr}. */
export function execFileNoThrow(
  cmd: string,
  args: string[],
  cwd?: string,
  env?: NodeJS.ProcessEnv,
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      {
        cwd,
        env: env ?? process.env,
        shell: false,
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        const code = err && typeof (err as { code?: number }).code === "number"
          ? ((err as { code?: number }).code as number)
          : err ? 1 : 0;
        resolve({
          code,
          stdout: stdout?.toString() ?? "",
          stderr: stderr?.toString() ?? "",
        });
      },
    );
  });
}
