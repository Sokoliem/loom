---
name: loom-tokens
description: Design-token authoring guide for loom — OKLCH, references, themes, cycle detection, lint discipline. Auto-invoke when the user mentions tokens, palette, theme, color, spacing, radius, typography.
---

# loom tokens

Tokens live as YAML under `tokens/<namespace>.yaml` and resolve through a pure function.

## Namespaces ship by default

`color`, `typography`, `spacing`, `radius`, `motion`, `theme`. You can add more.

## References

Use `{namespace.path}` for inter-token references. The resolver is pure: same inputs → same output.

```yaml
# tokens/color.yaml
seed:
  hue: 250
  chroma: 0.20
accent:
  primary: oklch(0.65 {seed.chroma} {seed.hue})
```

## OKLCH first

Use OKLCH (perceptual lightness) rather than hex. Better for theme generation, contrast math, and
dark-mode mirroring.

## Cycle safety

Cycles error at parse time, naming the cycle path. `token_set` re-validates before persisting.

## Lint discipline

`/loom:validate ds-lint` flags raw color literals outside the token graph. Escape:

```tsx
// loom-ignore-next-line
const url = "url('data:image/svg+xml;...')";
```

## Themes

`tokens/theme.yaml` defines theme-keyed values. The default theme is `light`. Override per-token by
publishing a theme-scoped key.

## When the user asks for a palette

Don't pick random hexes. Set `seed.hue` and `seed.chroma`; let the rest of the palette derive.
For dark mode, mirror lightness via `oklch(0.18 …)` rather than inverting.

## Tools

`token_get`, `token_set`, `token_list`, `token_resolve_all`. All accept an optional `project` arg.
