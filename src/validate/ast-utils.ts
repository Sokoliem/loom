import * as babelParser from "@babel/parser";

export interface SourceLocation {
  line: number;
  column: number;
}

export type Node = {
  type: string;
  loc?: { start: SourceLocation; end: SourceLocation };
  [k: string]: unknown;
};

/** Parse JS, JSX, TS, and TSX. Babel-parser handles all four uniformly. */
export function parseFile(source: string): Node {
  return babelParser.parse(source, {
    sourceType: "module",
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    errorRecovery: true,
    plugins: ["jsx", "typescript", "classProperties", "decorators-legacy", "topLevelAwait"],
  }) as unknown as Node;
}

/** Manual recursive walker. Calls visitor on every node; returning false skips children. */
export function walkAll(root: Node, visitor: (node: Node, parent: Node | null) => void | false): void {
  const stack: Array<{ node: Node; parent: Node | null }> = [{ node: root, parent: null }];
  while (stack.length > 0) {
    const { node, parent } = stack.pop()!;
    const r = visitor(node, parent);
    if (r === false) continue;
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "start" || key === "end" || key === "type" || key === "raw") continue;
      const val = node[key];
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item && typeof item === "object" && typeof (item as Node).type === "string") {
              stack.push({ node: item as Node, parent: node });
            }
          }
        } else if (typeof (val as Node).type === "string") {
          stack.push({ node: val as Node, parent: node });
        }
      }
    }
  }
}
