# loom architecture

## One-page picture

```
+---------------------------------------------------+
|  Claude Code / Claude Desktop / Codex CLI         |
|        (user-facing chat surface, OAuth-only)     |
+--------------------------+------------------------+
                           | stdio MCP
                           v
+---------------------------------------------------+
|  loom-tools MCP server (src/mcp/server.ts)        |
|  - registers ~40 tools via src/mcp/registry.ts    |
|  - dispatches to core / validate / export /       |
|    panel / forge / reviews / doctor modules       |
+--------------------------+------------------------+
                           | direct call
                           v
+---------------------------------------------------+
|  core modules                                     |
|  - project.ts       lifecycle + SQLite registry   |
|  - tokens.ts        YAML + OKLCH + cycle-safe     |
|  - components.ts    CRUD + filesystem layout      |
|  - routes.ts        FS routing + meta             |
|  - version.ts       Merkle manifest + branches    |
|  - watcher.ts       chokidar + manifest-hash     |
|  - db.ts            better-sqlite3 schemas       |
|  - hash.ts          sha256 + canonicalize        |
+--------------------------+------------------------+
                           | HTTP/WS
                           v
+---------------------------------------------------+
|  daemon (src/daemon.ts)                           |
|  - Fastify on 127.0.0.1:5174 (or next free)       |
|  - /api/loom/healthz, /projects, /current,        |
|    /manifest, /stage-url, /ws                     |
|  - broadcasts: hello, route_changed,              |
|    version_snapshot, panel_finding,               |
|    forge_iteration, validation_complete           |
+---------------------------------------------------+

+---------------------------------------------------+
|  vite-plugin-loom-ids                             |
|  - enforce:'pre' Vite plugin                      |
|  - AST-walks JSX, injects data-loom-id           |
|  - handles spread + map-key                       |
|  - content-hash cached                            |
+---------------------------------------------------+
```

## Data flow — Claude writes a component

```
Claude (chat)
  └─ Tool: component_create({name:'Hero', jsx:'...'})
     └─ MCP server: registry.ts → componentCreate()
        └─ writes files to disk under components/Hero/
     └─ chokidar watcher fires
        └─ manifest hash recomputed
        └─ daemon broadcasts route_changed via WS
        └─ studio UI / Vite preview HMRs
```

## Data flow — `/loom:panel`

```
User: /loom:panel routes/pricing.tsx
  └─ Claude reads panel command markdown
  └─ Tool: panel_run({scope:'routes/pricing.tsx'})
     └─ planPanelRun() → {runId, agents[5], dispatchInstructions}
  └─ Claude dispatches 5 Task subagents IN PARALLEL
     (visual-critic, a11y-reviewer, copy-editor, brand-keeper, responsive-checker)
  └─ Each agent returns JSON findings array
  └─ Claude synthesizes (dedupe, severity-merge, contradiction-surface)
  └─ Tool: panel_ingest_findings({runId, scope, findings})
     └─ persists to validation_runs (kind='panel')
  └─ Claude renders the report; offers per-finding Apply/Defer
```

## Data flow — `/loom:forge`

```
User: /loom:forge --route /pricing --goal "tighter hierarchy"
  └─ Tool: forge_run({route_path, goal, max_iters, max_cost_usd})
     └─ assertCleanWorkingTree() — refuses if dirty (E_FORGE_PRECONDITION)
     └─ git worktree add -b loom-forge/<runId> <worktree_path> <currentBranch>
     └─ insert forge_runs(outcome='running')
     └─ returns loopInstructions
  └─ Claude runs the loop IN-SESSION:
     for i in 1..N:
       render → Task(visual-critic-with-goal) → Edit → render → Task(forge-judge) → record
  └─ On convergence ≥75:
     Tool: forge_squash({runId})
       └─ git merge --squash loom-forge/<runId>; git commit; rev-parse HEAD
       └─ git worktree remove --force
       └─ update forge_runs(outcome='converged', squash_commit_sha=...)
```

## On-disk project layout

```
<project>/
├── loom.yaml                # manifest (name, themes, features)
├── tokens/                  # color, typography, spacing, radius, motion, theme
├── components/
│   └── Button/
│       ├── Button.tsx
│       ├── Button.spec.md
│       ├── Button.tokens.yaml
│       ├── Button.a11y.yaml
│       └── Button.stories.mdx
├── routes/
│   ├── _layout.tsx
│   └── index.tsx
├── mock-data/
├── assets/{images,fonts}/
├── exports/                 # gitignored
└── .loom/
    ├── project.sqlite       # version graph, validation, forge, tokens cache, reviews
    ├── snapshots/           # PNG renders by hash (gitignored)
    ├── validation/          # axe/lint reports (gitignored)
    ├── forge/<runId>/       # git worktrees (gitignored)
    ├── manifest-hash        # current content hash (gitignored)
    └── secret               # 32-byte hex, mode 600
```

## SQLite schemas

See `src/core/db.ts`. Two DBs:

- **`~/.loom/server/server.sqlite`** — `projects`, `server_state`, `telemetry_events`.
- **`<project>/.loom/project.sqlite`** — `versions`, `branches`, `file_blobs`, `validation_runs`, `forge_runs`, `token_cache`, `review_threads`, `route_states`.

WAL mode, `synchronous=NORMAL`, `busy_timeout=5000`.

## Determinism

- **Same-OS hash equality.** `version_id = sha256(canonicalize({path: sha256(content)}))` for all tracked files. Three runs of `buildManifest()` on the same content produce identical hashes (verified in `tests/version.test.ts`).
- **Element IDs.** `data-loom-id = sha256(componentPath:componentName:staticProps:spreadLoc:mapKey:parentId:siblingIndex).slice(0,12)`. Verified stable across runs in `tests/element-ids.test.ts`.
- **Token resolution.** Pure function of the loaded YAML. Cycles error at parse time naming the cycle path.
- **Exports.** Pure function of `(versionId, target, options)`.

## What is intentionally out of scope (v0.9)

- Per-project Vite dev server (planned for v1.0 hardening — the daemon currently doesn't spawn it; users run `npm run dev` in the exported folder or in the project root after wiring the plugin).
- Playwright snapshot rendering (graceful no-op stubs when Playwright isn't installed).
- Cross-OS perceptual diff CI (same-OS deterministic CI scaffold present in tests).
- warp tunnel for remote review URLs.

These are all explicitly tracked in `loom-implementation-plan.md` Phase 4 / v1.1.
