#!/usr/bin/env node
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { deflateRawSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST_ZIP = join(ROOT, "loom-plugin.zip");

const INCLUDE = [
  ".claude-plugin",
  "commands",
  "agents",
  "skills",
  "templates",
  "dist",
  "install",
  "docs",
  "package.json",
  "README.md",
  "LICENSE",
];

const OPTIONAL_INCLUDE = ["LICENSE"];

async function main() {
  if (!existsSync(join(ROOT, "dist", "mcp", "server.js"))) {
    console.error("dist/mcp/server.js not found — run `npm run build` first");
    process.exit(1);
  }

  // Ensure LICENSE exists
  if (!existsSync(join(ROOT, "LICENSE"))) {
    writeFileSync(
      join(ROOT, "LICENSE"),
      `MIT License

Copyright (c) 2026 Eric Sokolowski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,
    );
  }

  const files = [];
  for (const entry of INCLUDE) {
    const full = join(ROOT, entry);
    if (!existsSync(full)) {
      if (OPTIONAL_INCLUDE.includes(entry)) continue;
      console.warn(`skipping missing: ${entry}`);
      continue;
    }
    addRecursive(full, files);
  }

  await writeZip(DIST_ZIP, files);

  // Also write a .plugin metadata file alongside the zip — same content, different name —
  // some MCP managers expect a `.plugin` artifact extension.
  writePluginCopy(DIST_ZIP);

  const stat = statSync(DIST_ZIP);
  console.log(`Wrote ${DIST_ZIP} (${(stat.size / 1024).toFixed(1)} KB, ${files.length} files)`);
}

function addRecursive(root, out) {
  const st = statSync(root);
  if (st.isFile()) {
    out.push({ abs: root, rel: relative(ROOT, root).split(sep).join("/") });
    return;
  }
  for (const entry of readdirSync(root)) {
    if (entry === "node_modules" || entry === ".loom" || entry === ".git") continue;
    const full = join(root, entry);
    addRecursive(full, out);
  }
}

function writeZip(outPath, files) {
  return new Promise((resolve, reject) => {
  const fd = createWriteStream(outPath);
  fd.on("close", () => resolve());
  fd.on("error", reject);
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const f of files) {
    const data = readFileSync(f.abs);
    const compressed = deflateRawSync(data);
    const compressedLen = compressed.length;
    const useDeflate = compressedLen < data.length;
    const payload = useDeflate ? compressed : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);
    const nameBytes = Buffer.from(f.rel);

    const lfh = Buffer.alloc(30 + nameBytes.length);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(payload.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBytes.length, 26);
    lfh.writeUInt16LE(0, 28);
    nameBytes.copy(lfh, 30);

    const cdh = Buffer.alloc(46 + nameBytes.length);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(payload.length, 20);
    cdh.writeUInt32LE(data.length, 24);
    cdh.writeUInt16LE(nameBytes.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);
    nameBytes.copy(cdh, 46);

    localHeaders.push(lfh);
    fd.write(lfh);
    fd.write(payload);
    centralHeaders.push(cdh);
    offset += lfh.length + payload.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const cdh of centralHeaders) {
    fd.write(cdh);
    cdSize += cdh.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(centralHeaders.length, 8);
  eocd.writeUInt16LE(centralHeaders.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);
  fd.write(eocd);
  fd.end();
  });
}

function writePluginCopy(zipPath) {
  const dst = zipPath.replace(/\.zip$/, ".plugin");
  const data = readFileSync(zipPath);
  writeFileSync(dst, data);
  console.log(`Wrote ${dst} (${(data.length / 1024).toFixed(1)} KB)`);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
