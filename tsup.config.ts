import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    daemon: "src/daemon.ts",
    cli: "src/cli.ts",
    "mcp/server": "src/mcp/server.ts",
    "mcp/bootstrap": "src/mcp/bootstrap.ts",
    "vite-plugin-loom-ids/index": "src/vite-plugin-loom-ids/index.ts",
  },
  format: ["esm"],
  target: "node22",
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  outDir: "dist",
  shims: true,
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire as __loomCreateRequire } from 'node:module';\nconst require = __loomCreateRequire(import.meta.url);",
  },
  external: ["better-sqlite3", "playwright", "axe-core"],
  noExternal: [
    "@babel/parser",
    "@fastify/websocket",
    "@modelcontextprotocol/sdk",
    "acorn",
    "acorn-jsx",
    "acorn-walk",
    "chokidar",
    "fastify",
    "magic-string",
    "nanoid",
    "ulid",
    "ws",
    "yaml",
    "zod",
  ],
});
