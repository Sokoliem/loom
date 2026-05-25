#!/usr/bin/env node
/**
 * Bundles src/studio/terminal-client.ts into dist/vendor/terminal.js as an
 * IIFE for the browser. The daemon serves it from /__loom/vendor/terminal.js
 * and the studio chrome's terminal pane loads it via a <script> tag.
 *
 * Composes @celestial/rift's browser-side renderer; everything is bundled
 * inline so the chrome doesn't have to worry about import maps in the page.
 */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENTRY = resolve(ROOT, "src/studio/terminal-client.ts");
const OUT = resolve(ROOT, "dist/vendor/terminal.js");

mkdirSync(dirname(OUT), { recursive: true });

await build({
  entryPoints: [ENTRY],
  outfile: OUT,
  bundle: true,
  format: "iife",
  globalName: "__loomTerminalBoot",
  platform: "browser",
  target: ["es2020"],
  sourcemap: true,
  minify: false,
  logLevel: "info",
});

console.log(`Wrote ${OUT}`);
