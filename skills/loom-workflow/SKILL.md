---
name: loom-workflow
description: End-to-end loom workflow guide. Walks through new project → tokens → components → routes → snapshot → validate → panel → forge → export. Auto-invoke when the user mentions building a design, prototype, design system, or asks how to use loom.
---

# loom workflow

`loom` is a chat + stage design workspace. The user drives via slash commands; you wire the MCP
tools through `loom-tools`.

## The arc

1. **Create**: `/loom:new <name>` → scaffold project with shadcn-starter tokens + a Button + index route.
2. **Edit tokens**: `/loom:token set <ref> <value>` or `set seed.hue 220` to rotate the palette.
3. **Build components and routes** in chat. You write `.tsx` files under `components/` and `routes/`;
   the file watcher fires HMR; the stage updates without reload.
4. **Snapshot**: `/loom:snapshot v1` — content-addressed version row.
5. **Validate**: `/loom:validate` — runs token-lint, ds-lint, deterministic-lint. Add `axe` if Playwright.
6. **Panel**: `/loom:panel <scope>` — dispatches 5 agents in parallel, surfaces 3+ actionable findings.
7. **Forge**: `/loom:forge --route /pricing --goal "tighter hierarchy"` — in-session, git-worktree-scoped,
   iterates render→critique→edit→judge under iter+cost caps.
8. **Branch**: `/loom:branch create alt-direction` to explore in parallel. Merge via 3-way.
9. **Export**: `/loom:export react-shadcn --out ./exports/<x>` → standalone Vite/React/Tailwind project.

## When the user says…

- "build me a landing page" → write components + a route in `routes/`. Stage HMRs.
- "make it pop more" → suggest `/loom:forge --goal "<their goal>"`.
- "I want stakeholder feedback" → `/loom:review create …` and share the stage URL.
- "is it accessible" → `/loom:validate axe` (or `/loom:panel` for the broader pass).
- "ship to engineering" → `/loom:export react-shadcn` and walk through the README.

## Architectural invariants you must respect

- **Filesystem is source of truth.** Every write goes through the disk; the daemon's watcher
  recomputes the manifest hash and broadcasts HMR. Do not maintain in-memory state that diverges.
- **OAuth-only.** Never invoke `claude -p` or the Agent SDK. The MCP server is the surface.
- **Forge runs are git-worktree-scoped.** Working tree must be clean (the tool will refuse).
- **Cross-OS determinism is perceptual.** Hash equality is same-OS only.
