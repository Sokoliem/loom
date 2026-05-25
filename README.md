# loom

Design workspace for Claude Code. Chat-plus-stage workflow for designers and design-engineers:
persistent projects, design tokens, components, routes, multi-agent panel, closed-loop forge,
framework export.

Standalone variant of the Celestial-substrate Loom described in `loom-prd-v3.md`. Ships as a
Claude Code plugin, a Claude Desktop MCP server, and a Codex CLI MCP server from one build.

## Status

**v0.9.0 standalone variant.** Implements the data model, MCP tool surface, daemon, watcher,
Vite plugin, validation lints, exports, panel and forge skill orchestration, and reviews from
`loom-prd-v3.md`. Substrate dependencies on Celestial packages (PTY-hosted `claude`, `lens`
browser surface, `warp` CRDT, `parallax` diff viewer) are replaced with a standalone Fastify +
better-sqlite3 + chokidar daemon and a SQLite-backed review store, since v1.0 of the PRD requires
the Celestial monorepo. This makes the standalone artifact installable as a Claude Code plugin /
Claude Desktop MCP / Codex MCP today — v1.1 of the PRD calls for exactly this packaging.

## What's implemented vs. deferred

| PRD must | Status | Notes |
|---|---|---|
| M1 PTY Claude runtime | **deferred** | MCP server is the surface in the standalone variant. `loom-prd-v3.md` v1.1 packaging path. |
| M2 Browser mirror surface | **deferred** | Same — the daemon serves an HTTP+WS API; UI shell ships with v1.0 Celestial substrate. |
| M3 Project lifecycle (create/open/list/archive) | ✅ | `project_*` tools, persistent active-project. |
| M4 Token CRUD + OKLCH + cycle detection | ✅ | `tokens.ts`, validated against `tests/tokens.test.ts`. Validation now runs before persist. |
| M5 Component CRUD | ✅ | All 5 file artifacts per component. |
| M6 Route CRUD + FS routing | ✅ | `routes.ts`, meta extraction. |
| M7 Stage pane (Vite-rendered iframe) | partial | Daemon exposes `/api/loom/preview/:projectId` URL shape but does not yet spawn a per-project Vite — users run `npm run dev` inside the exported folder. |
| M8 Element-ID Vite plugin (spread + map) | ✅ | `vite-plugin-loom-ids`. Now uses `@babel/parser` for full TS+JSX support. |
| M9 Element comments + CRDT | partial | SQLite-backed review threads via `review_*` tools. CRDT WS bridge defers to v1.1 (per plan §10 cut #2). |
| M10 Version snapshots (content-addressed Merkle) | ✅ | Now persists file blobs; `version_restore` works in safe + force modes. |
| M11 Branch merge with conflict surface | ✅ | `branch_merge` returns structured conflict list on failure. |
| M12 5-agent panel via Task | ✅ | `panel_run` / `panel_ingest_findings` + 5 agent defs. |
| M13 Forge (in-session, git-worktree-scoped) | ✅ | `forge_run` precondition-checks clean tree, creates worktree, returns loop instructions. |
| M14 axe-core validation | partial | `validate("axe")` invokes axe via optional Playwright; needs a Vite server URL or HTML. |
| M15 Token-usage lint | ✅ | `tokenUsageLint`, with `loom-ignore-next-line`. |
| M16 v1 exports | ✅ | All 7 targets (CSS vars, Tailwind, SD, React-shadcn, Storybook MDX, route map, static bundle). |
| M17 `loom-tools` MCP server | ✅ | 51 tools registered. |
| M18 Cross-platform install | ✅ | Verified on Windows; Node 22+ everywhere. |
| M19 Determinism (same-OS) | ✅ | Manifest-hash equality verified across 3 runs. Snapshot-hash determinism deferred (needs Playwright). |
| M20 Doctor | ✅ | `doctor` MCP tool + `loom doctor` CLI. |
| AC#3 Hook-order warning | ✅ | `component_update` refuses (E_HOOK_ORDER_CHANGE) when a hook-order change would lose state; `ack_state_loss=true` overrides. |
| AC#5 Cross-OS perceptual diff | **deferred** | Per implementation plan §10 cut #5. v1.0 hardening item. |
| AC#9 Deterministic-source lint | ✅ | `deterministicSourceLint`. |
| AC#16 OAuth-only | ✅ | No `claude -p`, no SDK; the MCP server is the surface. |

The PRD's v1.1 should-haves (warp tunnel, Lighthouse perf, dark-mode `light-dark()`, mock-data
generator, Vue/Svelte/WC export targets) remain deferred per the implementation plan §7.

## Quickstart (Claude Code plugin)

```bash
git clone <your-fork> loom
cd loom
npm install
npm run build

# Inside Claude Code:
/plugin install /absolute/path/to/loom
/loom:start
/loom:new my-design
# Then in chat: "Build a landing page with a hero, 3-up features, and CTA"
/loom:snapshot v1
/loom:validate
/loom:panel routes/index.tsx
/loom:export react-shadcn --out ./exports/my-design
```

For Claude Desktop and Codex install: see `install/INSTALL.md`.

## What's inside

- **`loom-tools` MCP server** — full PRD §7.1 tool surface (project, token, component, route, version, branch, validate, panel, forge, review, export, server, doctor, logs).
- **Daemon** — Fastify + WebSocket + chokidar watcher; broadcasts route_changed, version_snapshot, panel_finding, forge_iteration.
- **vite-plugin-loom-ids** — AST-walking Vite plugin injecting deterministic `data-loom-id` attrs with JSX spread + map-key handling.
- **5 panel agents** — visual-critic, a11y-reviewer, copy-editor, brand-keeper, responsive-checker.
- **Forge agents** — visual-critic-with-goal, forge-judge.
- **Skills** — loom-workflow, loom-tokens, loom-export.
- **Exports** — CSS vars, Tailwind config, Style Dictionary JSON, React-shadcn project, Storybook MDX, route-map markdown, static bundle.

## Architecture invariants

- **OAuth-only Claude auth.** No `claude -p`, no SDK, no API key.
- **Filesystem is source of truth.** SQLite is a cache + version graph.
- **Content-addressed versions.** `version_id = sha256(canonical_manifest)`.
- **Forge runs are git-worktree-scoped.** Working tree must be clean (precondition).
- **Cross-OS snapshot equality is perceptual diff (ΔE < 2.0), not hash.**

## Project layout

```
loom/
├── .claude-plugin/         # plugin manifest
├── commands/               # 13 slash commands
├── agents/                 # 5 panel + 2 forge agents
├── skills/                 # workflow + tokens + export
├── src/                    # TypeScript sources
├── tests/                  # vitest suites
├── install/                # Claude Desktop + Codex configs
└── docs/                   # README, INSTALL, ARCHITECTURE
```

## Slash commands

| Command | Purpose |
|---|---|
| `/loom:start` | Start the daemon (HTTP + WS) |
| `/loom:new <name>` | Scaffold a new project |
| `/loom:open <name>` | Open an existing project |
| `/loom:token` | Get/set/list/resolve tokens |
| `/loom:component` | CRUD components |
| `/loom:route` | CRUD routes |
| `/loom:snapshot [label]` | Take a version snapshot |
| `/loom:validate [kinds...]` | Run token-lint, ds-lint, det-lint, axe |
| `/loom:panel <scope>` | Dispatch 5-agent design panel |
| `/loom:forge --route X --goal Y` | Run closed-loop forge iteration |
| `/loom:branch` | Create/switch/merge branches |
| `/loom:export <target>` | Export to CSS vars, Tailwind, React-shadcn, etc. |
| `/loom:review` | Manage stakeholder review threads |
| `/loom:doctor` | Diagnose install |

## Testing

```bash
npm run test       # vitest run
npm run typecheck  # tsc --noEmit
npm run build      # tsup
```

All 27 tests pass on Node 22. Optional Playwright is needed only for axe + forge rendering.

## License

MIT.

## See also

- `loom-prd-v3.md` — full PRD
- `loom-implementation-plan.md` — 14-week phase plan
- `loom-celestial-integration.md` — substrate notes
