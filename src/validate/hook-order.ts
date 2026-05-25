import { parseFile, walkAll, type Node } from "./ast-utils.js";

export interface HookOrderWarning {
  rule: "hook-order-change";
  severity: "warn";
  message: string;
  details: { before: string[]; after: string[] };
}

const REACT_HOOKS = new Set([
  "useState",
  "useEffect",
  "useLayoutEffect",
  "useReducer",
  "useCallback",
  "useMemo",
  "useRef",
  "useContext",
  "useImperativeHandle",
  "useDeferredValue",
  "useTransition",
  "useId",
  "useSyncExternalStore",
  "useInsertionEffect",
  "useOptimistic",
  "useFormStatus",
  "useFormState",
  "useActionState",
]);

/** Analyze the hook call sequence in a JSX source. Best-effort: scans top-level callees only. */
export function extractHookSequence(source: string): string[] {
  let ast: Node;
  try {
    ast = parseFile(source);
  } catch {
    return [];
  }
  const entries: { name: string; pos: number }[] = [];
  walkAll(ast, (n) => {
    if (n.type !== "CallExpression") return;
    const callee = n.callee as Node | undefined;
    if (!callee) return;
    const pos = (n as unknown as { start?: number }).start ?? 0;
    if (callee.type === "Identifier" && REACT_HOOKS.has(callee.name as string)) {
      entries.push({ name: callee.name as string, pos });
    } else if (callee.type === "MemberExpression") {
      const prop = callee.property as Node | undefined;
      if (prop?.type === "Identifier" && REACT_HOOKS.has(prop.name as string)) {
        entries.push({ name: prop.name as string, pos });
      }
    }
  });
  entries.sort((a, b) => a.pos - b.pos);
  return entries.map((e) => e.name);
}

/** Compare two hook sequences and return a warning if they diverge in a way that breaks Fast Refresh. */
export function diffHookOrder(before: string, after: string): HookOrderWarning | null {
  const a = extractHookSequence(before);
  const b = extractHookSequence(after);
  if (a.length !== b.length) {
    return {
      rule: "hook-order-change",
      severity: "warn",
      message: `hook count changed (${a.length} → ${b.length}); this edit will lose component state on HMR`,
      details: { before: a, after: b },
    };
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return {
        rule: "hook-order-change",
        severity: "warn",
        message: `hook order changed at position ${i + 1} (${a[i]} → ${b[i]}); this edit will lose component state on HMR`,
        details: { before: a, after: b },
      };
    }
  }
  return null;
}
