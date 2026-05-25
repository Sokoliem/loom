import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { E } from "./errors.js";
import { componentsDir } from "./paths.js";
import { diffHookOrder, type HookOrderWarning } from "../validate/hook-order.js";

export interface ComponentSpec {
  name: string;
  description?: string;
  variants?: string[];
  uses_tokens?: string[];
  jsx?: string;
}

export interface ComponentRecord {
  name: string;
  hasComponent: boolean;
  hasSpec: boolean;
  hasTokens: boolean;
  hasA11y: boolean;
  hasStories: boolean;
  path: string;
}

const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

export function componentCreate(projectDir: string, spec: ComponentSpec): ComponentRecord {
  if (!NAME_RE.test(spec.name)) {
    throw E.invalid("component name", "PascalCase only");
  }
  const dir = join(componentsDir(projectDir), spec.name);
  if (existsSync(dir)) throw E.exists("component", spec.name);
  mkdirSync(dir, { recursive: true });

  const jsx = spec.jsx ?? defaultJsx(spec);
  writeFileSync(join(dir, `${spec.name}.tsx`), jsx);
  writeFileSync(
    join(dir, `${spec.name}.spec.md`),
    `# ${spec.name}\n\n${spec.description ?? "(describe purpose, variants, usage)"}\n`,
  );
  writeFileSync(
    join(dir, `${spec.name}.tokens.yaml`),
    YAML.stringify({ uses: spec.uses_tokens ?? [] }),
  );
  writeFileSync(
    join(dir, `${spec.name}.a11y.yaml`),
    YAML.stringify({
      requires: { contrast_ratio: 4.5, focus_visible: true, keyboard_activates: true },
    }),
  );
  writeFileSync(
    join(dir, `${spec.name}.stories.mdx`),
    `import { ${spec.name} } from "./${spec.name}";\n\n# ${spec.name}\n\n<${spec.name} />\n`,
  );
  return componentGet(projectDir, spec.name);
}

export function componentGet(projectDir: string, name: string): ComponentRecord {
  const dir = join(componentsDir(projectDir), name);
  if (!existsSync(dir)) throw E.notFound("component", name);
  return {
    name,
    hasComponent: existsSync(join(dir, `${name}.tsx`)),
    hasSpec: existsSync(join(dir, `${name}.spec.md`)),
    hasTokens: existsSync(join(dir, `${name}.tokens.yaml`)),
    hasA11y: existsSync(join(dir, `${name}.a11y.yaml`)),
    hasStories: existsSync(join(dir, `${name}.stories.mdx`)),
    path: dir,
  };
}

export function componentList(projectDir: string, filter?: string): ComponentRecord[] {
  const dir = componentsDir(projectDir);
  if (!existsSync(dir)) return [];
  const out: ComponentRecord[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (!NAME_RE.test(entry)) continue;
    if (filter && !entry.toLowerCase().includes(filter.toLowerCase())) continue;
    out.push(componentGet(projectDir, entry));
  }
  return out;
}

export interface ComponentPatch {
  jsx?: string;
  description?: string;
  uses_tokens?: string[];
  /** If true, write even when the hook-order changes. Default: false (throws with warning). */
  ack_state_loss?: boolean;
}

export interface ComponentUpdateResult extends ComponentRecord {
  hookOrderWarning?: HookOrderWarning;
}

export function componentUpdate(
  projectDir: string,
  name: string,
  patch: ComponentPatch,
): ComponentUpdateResult {
  const rec = componentGet(projectDir, name);
  let warning: HookOrderWarning | undefined;
  if (patch.jsx !== undefined) {
    const file = join(rec.path, `${name}.tsx`);
    const before = readFileSync(file, "utf8");
    const detected = diffHookOrder(before, patch.jsx);
    if (detected && !patch.ack_state_loss) {
      throw Object.assign(
        new Error(`${detected.message}; re-call with { ack_state_loss: true } to proceed`),
        { code: "E_HOOK_ORDER_CHANGE", hint: JSON.stringify(detected.details) },
      );
    }
    warning = detected ?? undefined;
    writeFileSync(file, patch.jsx);
  }
  if (patch.description !== undefined) {
    writeFileSync(join(rec.path, `${name}.spec.md`), `# ${name}\n\n${patch.description}\n`);
  }
  if (patch.uses_tokens !== undefined) {
    writeFileSync(
      join(rec.path, `${name}.tokens.yaml`),
      YAML.stringify({ uses: patch.uses_tokens }),
    );
  }
  return { ...componentGet(projectDir, name), hookOrderWarning: warning };
}

export function componentDelete(projectDir: string, name: string): void {
  const dir = join(componentsDir(projectDir), name);
  if (!existsSync(dir)) throw E.notFound("component", name);
  rmSync(dir, { recursive: true, force: true });
}

export function componentReadSource(projectDir: string, name: string): string {
  const rec = componentGet(projectDir, name);
  return readFileSync(join(rec.path, `${name}.tsx`), "utf8");
}

function defaultJsx(spec: ComponentSpec): string {
  return `import { type ReactNode } from "react";

interface ${spec.name}Props {
  children?: ReactNode;
}

export function ${spec.name}({ children }: ${spec.name}Props) {
  return <div>{children}</div>;
}
`;
}
