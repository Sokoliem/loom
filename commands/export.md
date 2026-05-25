---
description: Export the project. Usage: /loom:export <target> [--out <dir>]
argument-hint: <css-vars|tailwind|style-dictionary|react-shadcn|storybook-mdx|route-map-md|static-bundle> [--out <dir>]
allowed-tools: ["mcp__loom-tools__export"]
---

Parse `$ARGUMENTS` for `<target>` and optional `--out <dir>`.

1. Call `mcp__loom-tools__export` with `{ target, out_dir }`.
2. Surface `outDir` and the list of files produced.
3. For `react-shadcn`, remind the user to run `pnpm install && pnpm run build` inside the output.
