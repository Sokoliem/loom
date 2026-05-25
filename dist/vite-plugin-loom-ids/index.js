#!/usr/bin/env node

// src/vite-plugin-loom-ids/index.ts
import { readFileSync } from "fs";
import { relative } from "path";
import MagicString from "magic-string";
import { createHash } from "crypto";

// src/validate/ast-utils.ts
import * as babelParser from "@babel/parser";
function parseFile(source) {
  return babelParser.parse(source, {
    sourceType: "module",
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    errorRecovery: true,
    plugins: ["jsx", "typescript", "classProperties", "decorators-legacy", "topLevelAwait"]
  });
}
function walkAll(root, visitor) {
  const stack = [{ node: root, parent: null }];
  while (stack.length > 0) {
    const { node, parent } = stack.pop();
    const r = visitor(node, parent);
    if (r === false) continue;
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "start" || key === "end" || key === "type" || key === "raw") continue;
      const val = node[key];
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item && typeof item === "object" && typeof item.type === "string") {
              stack.push({ node: item, parent: node });
            }
          }
        } else if (typeof val.type === "string") {
          stack.push({ node: val, parent: node });
        }
      }
    }
  }
}

// src/vite-plugin-loom-ids/index.ts
var cache = /* @__PURE__ */ new Map();
function loomIds(options = {}) {
  const attrName = options.attrName ?? "data-loom-id";
  const projectRoot = options.projectRoot ?? process.cwd();
  const useCache = options.cache !== false;
  return {
    name: "vite-plugin-loom-ids",
    enforce: "pre",
    transform(code, id) {
      if (!/\.(tsx|jsx)$/.test(id)) return null;
      if (id.includes("node_modules")) return null;
      const contentHash = createHash("sha256").update(code).digest("hex").slice(0, 12);
      const cacheKey = id;
      if (useCache) {
        const cached = cache.get(cacheKey);
        if (cached && cached.hash === contentHash) {
          return applyInjections(code, cached.injections, attrName);
        }
      }
      let ast;
      try {
        ast = parseFile(code);
      } catch {
        return null;
      }
      const rel = relative(projectRoot, id).replace(/\\/g, "/");
      const injections = [];
      walkJsx(ast, rel, "root", (point) => injections.push(point));
      if (useCache) {
        cache.set(cacheKey, { hash: contentHash, injections });
      }
      return applyInjections(code, injections, attrName);
    }
  };
}
function applyInjections(code, injections, attrName) {
  if (injections.length === 0) return null;
  const s = new MagicString(code);
  for (const i of injections) {
    s.appendLeft(i.start, ` ${attrName}="${i.id}"`);
  }
  return {
    code: s.toString(),
    map: s.generateMap({ hires: true })
  };
}
function walkJsx(ast, componentPath, rootId, push) {
  walkChildren(ast, { componentPath, parentId: rootId, siblingIndex: 0, spreadLoc: null, mapKey: null }, push);
}
function walkChildren(node, ctx, push) {
  let siblingIdx = 0;
  walkAll(node, (n, parent) => {
    if (n.type !== "JSXOpeningElement") return;
    if (skip(n)) return;
    const componentName = openingNameToString(n.name);
    const staticProps = extractStaticProps(n);
    const spreadLoc = spreadSourceLoc(n);
    const mapKey = inferMapKey(parent);
    const id = hashId({
      componentPath: ctx.componentPath,
      componentName,
      staticProps,
      spreadLoc,
      mapKey,
      parentId: ctx.parentId,
      siblingIndex: siblingIdx++
    });
    const namePos = posOfName(n.name);
    if (namePos !== null) {
      push({ start: namePos, id });
    }
  });
}
function skip(n) {
  const attrs = n.attributes ?? [];
  return attrs.some((a) => {
    if (a.type !== "JSXAttribute") return false;
    const name = a.name;
    return name?.type === "JSXIdentifier" && name.name === "data-loom-id";
  });
}
function openingNameToString(name) {
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") {
    return `${openingNameToString(name.object)}.${openingNameToString(name.property)}`;
  }
  return name.type;
}
function posOfName(name) {
  const end = name.end;
  return typeof end === "number" ? end : null;
}
var LITERAL_TYPES = /* @__PURE__ */ new Set([
  "Literal",
  "StringLiteral",
  "NumericLiteral",
  "BooleanLiteral",
  "NullLiteral"
]);
function extractStaticProps(opening) {
  const out = {};
  const attrs = opening.attributes ?? [];
  for (const a of attrs) {
    if (a.type !== "JSXAttribute") continue;
    const name = a.name;
    const value = a.value;
    if (!name || !value) continue;
    const propName = name.type === "JSXIdentifier" ? name.name : "_";
    if (LITERAL_TYPES.has(value.type)) {
      out[propName] = value.value;
    } else if (value.type === "JSXExpressionContainer") {
      const inner = value.expression;
      if (inner && LITERAL_TYPES.has(inner.type)) {
        out[propName] = inner.value;
      }
    }
  }
  const sortedKeys = Object.keys(out).sort();
  const sorted = {};
  for (const k of sortedKeys) sorted[k] = out[k];
  return sorted;
}
function spreadSourceLoc(opening) {
  const attrs = opening.attributes ?? [];
  for (const a of attrs) {
    if (a.type === "JSXSpreadAttribute") {
      const loc = a.loc?.start;
      return loc ? `L${loc.line}:C${loc.column}` : "spread";
    }
  }
  return null;
}
function inferMapKey(parent) {
  if (!parent) return null;
  if (parent.type !== "ArrowFunctionExpression" && parent.type !== "FunctionExpression") return null;
  return null;
}
function hashId(input) {
  const h = createHash("sha256");
  h.update(input.componentPath);
  h.update(":");
  h.update(input.componentName);
  h.update(":");
  h.update(JSON.stringify(input.staticProps));
  h.update(":");
  h.update(input.spreadLoc ?? "");
  h.update(":");
  h.update(input.mapKey ?? "");
  h.update(":");
  h.update(input.parentId);
  h.update(":");
  h.update(String(input.siblingIndex));
  return h.digest("hex").slice(0, 12);
}
function injectIdsForTesting(source, filePath) {
  const ast = parseFile(source);
  const injections = [];
  walkJsx(ast, filePath, "root", (i) => injections.push(i));
  if (injections.length === 0) return source;
  const s = new MagicString(source);
  for (const i of injections) s.appendLeft(i.start, ` data-loom-id="${i.id}"`);
  return s.toString();
}
function clearLoomIdCacheForTesting() {
  cache.clear();
}
function injectIdsFromFile(filePath) {
  return injectIdsForTesting(readFileSync(filePath, "utf8"), filePath);
}
export {
  clearLoomIdCacheForTesting,
  loomIds as default,
  injectIdsForTesting,
  injectIdsFromFile
};
//# sourceMappingURL=index.js.map