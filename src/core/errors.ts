import type { LoomError } from "../types.js";

export class LoomToolError extends Error {
  readonly code: string;
  readonly hint?: string;

  constructor(code: string, message: string, hint?: string) {
    super(message);
    this.code = code;
    this.hint = hint;
  }

  toJSON(): LoomError {
    return this.hint
      ? { code: this.code, message: this.message, hint: this.hint }
      : { code: this.code, message: this.message };
  }
}

export const E = {
  noProject: () =>
    new LoomToolError(
      "E_NO_PROJECT",
      "no project is open",
      "run project_open(name) or project_create(name) first",
    ),
  notFound: (kind: string, id: string) =>
    new LoomToolError(`E_${kind.toUpperCase()}_NOT_FOUND`, `${kind} '${id}' not found`),
  exists: (kind: string, id: string) =>
    new LoomToolError(`E_${kind.toUpperCase()}_EXISTS`, `${kind} '${id}' already exists`),
  invalid: (what: string, hint?: string) =>
    new LoomToolError("E_INVALID", `invalid ${what}`, hint),
  cycle: (path: string[]) =>
    new LoomToolError(
      "E_TOKEN_CYCLE",
      `token reference cycle: ${path.join(" → ")}`,
      "break the cycle by giving one node a literal value",
    ),
  forgePrecondition: (what: string) =>
    new LoomToolError("E_FORGE_PRECONDITION", what, "commit or stash your working tree first"),
} as const;
