import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    daemon: "src/daemon.ts",
    cli: "src/cli.ts",
    "mcp/server": "src/mcp/server.ts",
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
  banner: { js: "#!/usr/bin/env node" },
  external: ["better-sqlite3", "playwright", "axe-core"],
});
