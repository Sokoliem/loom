---
name: loom-export
description: Export guide for loom — CSS vars, Tailwind config, Style Dictionary, React-shadcn, Storybook MDX, route map, static bundle. Auto-invoke when the user mentions exporting, handing off, or shipping a design.
---

# loom export

Seven targets ship in v1:

| Target | Output |
|---|---|
| `css-vars` | `tokens.css` — `:root { --color-… }` |
| `tailwind` | `tailwind.config.cjs` — colors/spacing/fontSize/radius scales |
| `style-dictionary` | `tokens.json` — SD-compatible nested shape |
| `react-shadcn` | Standalone Vite/React/Tailwind project under `out/` |
| `storybook-mdx` | All components' `.stories.mdx` |
| `route-map-md` | `routes.md` — every route with title + state |
| `static-bundle` | One `bundle.html` — view-only preview |

## Determinism

Each export is a pure function of `(versionId, target, options)`. Re-running produces identical
files.

## React-shadcn round-trip

```bash
/loom:export react-shadcn --out ./exports/my-app
cd ./exports/my-app
pnpm install
pnpm run build
```

The export drops cleanly into a fresh Next.js / Vite app by copying `components/`, `routes/`,
`tokens.css`, and `tailwind.config.cjs` into the target project.

## Style-Dictionary handoff

Many design teams consume SD JSON for Figma plugins. Run `/loom:export style-dictionary` and
share `exports/style-dictionary/tokens.json`.

## When the user says "ship to engineering"

1. `/loom:export react-shadcn --out ./handoff` — full project shape.
2. `/loom:export route-map-md` — human-readable route inventory.
3. `/loom:export style-dictionary` — Figma-readable tokens.
4. Bundle the three under one folder and zip it.
