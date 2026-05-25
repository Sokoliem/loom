# CLAUDE.md — `loom`

Design workspace for Claude Code. Local-first, OAuth-only, single-driver.
Standalone variant of the Celestial app described in `loom-prd-v3.md` (PRD v1.1 plugin-SDK distribution).

## Project goals

`loom` lets a technically-literate designer or design-engineer drive Claude Code
through a chat-plus-stage workflow that has:

- Persistent projects with tokens, components, routes, mock data, assets, and version history.
- Multi-route prototypes with file-system routing, multi-viewport stage, and live HMR.
- Design system as a first-class object (OKLCH tokens, references, theme support, cycle-safe resolver).
- Element-pinned reviews, multi-agent design panel, closed-loop forge iteration.
- Framework export (CSS vars, Tailwind, Style Dictionary, React-shadcn, Storybook MDX, route-map MD).

See `loom-prd-v3.md`, `loom-implementation-plan.md`, `loom-celestial-integration.md`
for the full spec, phase plan, and design rationale.

## Repository layout

```
loom/
├── .claude-plugin/         # plugin manifest for Claude Code
├── src/                    # TypeScript sources
│   ├── daemon.ts           # Fastify + WS + chokidar
│   ├── mcp/                # MCP stdio server (loom-tools)
│   ├── core/               # project, tokens, components, routes, versions, db, watcher
│   ├── validate/           # axe, lints
│   ├── export/             # all export targets
│   ├── panel/              # panel skill orchestration
│   ├── forge/              # forge skill orchestration
│   └── vite-plugin-loom-ids/
├── commands/               # Claude Code slash commands
├── skills/                 # Claude Code skill bodies
├── agents/                 # 5 panel agents + forge agents
├── templates/              # starter templates (shadcn-starter)
├── tests/                  # vitest suites
├── docs/                   # README, INSTALL, ARCHITECTURE
├── scripts/                # build/package/install scripts
└── dist/                   # build output (gitignored)
```

## Distribution targets

`loom` ships three artifact shapes from one source:

- **Claude Code plugin** — `.claude-plugin/plugin.json` + commands + agents + skills + `.mcp.json`.
- **Claude Desktop MCP** — `mcp.json` snippet pointing at the built `loom-tools` server.
- **Codex MCP** — `config.toml` snippet pointing at the same server.

All three are bundled into `loom-plugin.zip` for download.

## Build commands

```bash
pnpm install                # install deps
pnpm build                  # tsup build → dist/
pnpm test                   # vitest run
pnpm package                # build + create loom-plugin.zip
```

## Architecture invariants (non-negotiable)

- **OAuth-only Claude auth.** No `claude -p`, no SDK, no API key. The MCP server is the surface.
- **Filesystem is source of truth.** SQLite is a cache + version graph; writes go to disk first, watcher fires HMR.
- **Content-addressed versions.** `version_id = sha256(canonical_manifest)`. Same inputs → same hash.
- **Element IDs are deterministic.** See PRD §6.5 for hash inputs including JSX spread + map key handling.
- **Forge runs are git-worktree-scoped.** User's working tree must be clean (precondition) and is physically untouched.
- **Cross-OS snapshot equality is perceptual diff (ΔE < 2.0), not hash.**
- **Default bind 127.0.0.1.** Tunnel mode is explicit opt-in.

## Conventions

- TypeScript strict mode, `"moduleResolution": "node16"`.
- Co-locate tests with sources: `foo.ts` → `foo.test.ts`.
- One commit per phase or per task within a phase; never mega-commits.
- Zod validates every MCP tool input.
- Errors are typed: `{ code, message, hint? }`.
- No comments unless WHY is non-obvious.

## Phase status

- Phase 0 (spike): complete (this initial build).
- Phase 1 (MVP): complete in v0.9.0 — all PRD §7.1 tools, file watcher, exports, lints.
- Phase 2 (panel + reviews): complete in v0.9.0 — 5-agent panel skill, review CRDT scaffold.
- Phase 3 (branch + forge): complete in v0.9.0 — git-worktree forge loop, branch tools.
- Phase 4 (hardening): partial — doctor, determinism, cross-OS CI deferred to v1.0.

## Working on this codebase

- Run `pnpm dev` to start the daemon in watch mode.
- `pnpm mcp` to run the MCP server in stdio mode for local testing.
- `pnpm doctor` checks Node version, Playwright availability, git, project-dir health.
- All new MCP tools register through `src/mcp/registry.ts`.
- All new exports register through `src/export/registry.ts`.

## Useful references

- `loom-prd-v3.md` — implementation-grade PRD
- `loom-implementation-plan.md` — phase plan + cut list
- `loom-celestial-integration.md` — substrate dependencies (note: standalone build replaces Celestial deps)
