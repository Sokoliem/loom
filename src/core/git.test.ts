import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _resetGitStatusCache, gitStatus, parsePorcelainV2 } from "./git.js";
import { execFileNoThrow } from "../utils/execFileNoThrow.js";

async function initRepo(dir: string): Promise<void> {
  await execFileNoThrow("git", ["init", "-q"], dir);
  await execFileNoThrow("git", ["config", "user.email", "t@example.com"], dir);
  await execFileNoThrow("git", ["config", "user.name", "t"], dir);
  writeFileSync(join(dir, "README.md"), "# test\n");
  await execFileNoThrow("git", ["add", "."], dir);
  await execFileNoThrow("git", ["commit", "-q", "-m", "init"], dir);
}

const cleanup: string[] = [];
afterEach(() => {
  _resetGitStatusCache();
  while (cleanup.length) {
    const dir = cleanup.pop();
    if (dir) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* windows fs lag */
      }
    }
  }
});

describe("gitStatus", () => {
  it("reports clean working tree on a fresh repo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "loom-git-"));
    cleanup.push(dir);
    await initRepo(dir);
    const s = await gitStatus(dir);
    expect(s.branch).toMatch(/^(main|master)$/);
    expect(s.dirty).toBe(false);
    expect(s.ahead).toBe(0);
    expect(s.behind).toBe(0);
    expect(s.stale).toBeFalsy();
  });

  it("reports dirty when there's an unstaged change", async () => {
    const dir = mkdtempSync(join(tmpdir(), "loom-git-"));
    cleanup.push(dir);
    await initRepo(dir);
    writeFileSync(join(dir, "README.md"), "# changed\n");
    const s = await gitStatus(dir);
    expect(s.dirty).toBe(true);
  });

  it("returns a sane shape even when the cwd is not the project's own repo", async () => {
    // We cannot reliably synthesize a "no git repo found" condition in a unit test
    // (depending on the host OS, parent dirs may contain a .git). The contract this
    // test enforces: the function always returns a usable GitStatus object that the
    // chrome can render without crashing, even when the repo state is ambiguous.
    const dir = mkdtempSync(join(tmpdir(), "loom-git-"));
    cleanup.push(dir);
    const s = await gitStatus(dir);
    expect(typeof s.dirty).toBe("boolean");
    expect(typeof s.ahead).toBe("number");
    expect(typeof s.behind).toBe("number");
    expect(s.branch === null || typeof s.branch === "string").toBe(true);
  });

  it("caches results within TTL", async () => {
    const dir = mkdtempSync(join(tmpdir(), "loom-git-"));
    cleanup.push(dir);
    await initRepo(dir);
    await gitStatus(dir);
    const cached = await gitStatus(dir);
    expect(cached.cached).toBe(true);
  });
});

describe("parsePorcelainV2", () => {
  it("parses branch + clean", () => {
    const out =
      "# branch.oid abcd\n" +
      "# branch.head main\n" +
      "# branch.upstream origin/main\n" +
      "# branch.ab +0 -0\n";
    expect(parsePorcelainV2(out)).toEqual({ branch: "main", dirty: false, ahead: 0, behind: 0 });
  });

  it("parses ahead/behind", () => {
    const out = "# branch.head main\n# branch.ab +3 -2\n";
    expect(parsePorcelainV2(out)).toMatchObject({ ahead: 3, behind: 2 });
  });

  it("flags dirty on any change line", () => {
    const out = "# branch.head main\n1 .M N... 100644 100644 100644 abcd abcd README.md\n";
    expect(parsePorcelainV2(out).dirty).toBe(true);
  });

  it("returns null branch on detached HEAD", () => {
    const out = "# branch.head (detached)\n";
    expect(parsePorcelainV2(out).branch).toBeNull();
  });

  it("returns the default-empty shape on empty input", () => {
    expect(parsePorcelainV2("")).toEqual({ branch: null, dirty: false, ahead: 0, behind: 0 });
  });
});
