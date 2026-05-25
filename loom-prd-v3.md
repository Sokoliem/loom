# PRD-Technical: `loom` — design workspace app on Celestial

**Status:** Implementation-grade. Supersedes `loom-prd.md` (v1 product vision) and `loom-prd-v2.md` (engineering synthesis).
**Owner:** Eric Sokolowski
**Authored:** 2026-05-24 (v3)
**Plugin name:** `loom`
**Repo location:** `apps/loom/` in the Celestial monorepo (sibling of `apps/claude-wrapper`)
**Distribution:** v1 ships as a Celestial app; v1.1 publishes a `plugin-sdk`-compatible npm-installable plugin variant.
**Companion docs:** `loom-celestial-integration.md` (package map), `loom-oauth-bridge.md` (PTY architecture), `loom-prd-v2-adversarial.md` (red-team), `loom-user-story.md` (E2E walkthrough), `loom-cli-integration.md` (wire protocol detail).

---

## 0. Document control

This PRD is implementation-grade and traceable. Every technical decision below cites either (a) the product driver it answers (Goal G1–G14 or a JTBD), (b) the prior-doc section it inherits from, or (c) the adversarial finding it resolves (T1–T16). Anything technical-only is flagged "[tech-only]".

Conventions used:

- **Celestial bindings** call out which existing package implements the capability. The package list and what each does is verified by reading `C:\Development\celestial\.worktrees\claude-wrapper-rewire\` source.
- **Adversarial fixes** prefix items that resolve red-team findings: `[fix T#]`.
- **Net-new** marks code Loom itself must author (vs. compose from Celestial).

---

## 1. Problem statement + evidence

Claude.ai Design (Anthropic Labs, launched 2026-04-17, powered by Opus 4.7) demonstrated that a chat-plus-stage interaction model unlocks design work for non-designers. It ships closed-source, cloud-only, behind a paywall, and explicitly missing four capabilities its own docs admit are gaps. Designers, design-engineers, and PMs currently route around the missing pieces by combining Claude.ai for ideation, Figma for system management, Storybook for components, Linear for feedback, and a dev environment for real data — a five-tool tax that defeats the value of the original simplification.

**Twelve specific capability gaps**, derived from the v2 PRD audit and Claude Design's own documentation:

| # | Gap | Source-of-evidence |
|---|---|---|
| 1 | No persistent project (each conversation is a fresh slate) | Claude.ai artifact scoping; absence of a `Project = {tokens, components, routes, assets, history}` primitive |
| 2 | No version history with diff / restore / branch | Anthropic admits this in Claude Design help docs |
| 3 | Single artifact per attempt | `web-artifacts-builder` and `artifact-studio` skills both produce single-file outputs |
| 4 | State-destroying reload | Documented in the prior `prototype-canvas-panel-spec.md` hot-reload analysis |
| 5 | No design system as first-class object | Anthropic admits |
| 6 | No multi-stakeholder review | Anthropic admits |
| 7 | No live data binding | `web-artifacts-builder` outputs static bundles |
| 8 | No export paths (no Figma, no Style Dictionary, no production code) | `web-artifacts-builder` outputs `bundle.html` only |
| 9 | No design-system conformance check | Existing tooling validates render, not token usage |
| 10 | No multi-agent design review | Anthropic's single-Opus model does both generation and self-critique |
| 11 | No closed-loop visual iteration | No headless render harness in the cloud product |
| 12 | No framework-fidelity export | HTML / PDF / PPTX / Canva only — can't drop into React/Vue codebases | Anthropic admits |

**The opportunity for Loom:** Anthropic's Claude Design users are already migrating because of gap 2 ("if the AI messes up your design you're stuck with it" — a top-rated complaint). The Claude Code installed base has the same audience plus the technical literacy to drive a richer local-first tool. The combination of *Celestial substrate already shipped* (PTY, browser surface, hook ingestion, mission control, multiplayer) and *Loom-specific surfaces yet to build* (design-system data model, panel, forge, framework export) is the right wedge.

---

## 2. Users + jobs-to-be-done

Three personas. Same as v2 PRD; restated for traceability.

**Primary — the technically literate designer or design-engineer.** Lives in Claude Code. Reads TS/React. Owns a product surface. Currently context-switches between five tools.

**Secondary — PMs and engineers doing design work.** Internal-tool UI, stakeholder prototypes, dogfood demos. The Claude Design target audience.

**Tertiary — design-system maintainers.** Care that components and tokens stay in sync. Need bidirectional, reviewable flow.

| Job | Today's path | With Loom |
|---|---|---|
| J1 — Sketch a multi-page flow | Figma static frames; or Claude.ai one-shot | `/loom:new` → `/loom:route add` × N → live preview with real nav |
| J2 — Establish tokens and reuse across screens | Figma variables + Style Dictionary manual export | `/loom:token set color.accent.primary oklch(...)` — referenced by every component, exported on demand |
| J3 — Build a component once and reuse | Storybook + manual import | `components/Button/` written once; routes reference `<Button>`; HMR propagates |
| J4 — Get stakeholder feedback on specific elements | Slack screenshots + threads | Reviewer opens shared preview URL (warp-CRDT), clicks an element, comment lands in studio |
| J5 — Show with real data | Mock JSON; or wire a backend | `/loom:data bind /dashboard linear.issues` via Claude Code's existing MCPs (v1.1) |
| J6 — A11y / responsive / perf review | Run axe, Lighthouse, BrowserStack manually | `/loom:review` runs all three plus design panel, scoped to selected routes |
| J7 — Multi-agent critique | None | `/loom:panel` dispatches 5 specialists in parallel |
| J8 — Closed-loop "iterate until right" | User-in-loop on every step | `/loom:forge` renders → critiques → edits → re-renders, bounded |
| J9 — Hand off to engineering | Figma + dev-mode + README | `/loom:export` → tokens (SD JSON, CSS vars, Tailwind), components (React-shadcn), routes (markdown), fixtures |
| J10 — Recover a design from 3 days ago | Git, if disciplined | `/loom:branch list` → `/loom:branch restore v8` |
| J11 — Run two design directions in parallel | Two Figma files | `/loom:branch create radical-redesign` → switch in studio UI |
| J12 — Stakeholder design review | Slack thread | warp-CRDT review URL + per-route review states (draft / in-review / approved) |

---

## 3. Goals + non-goals

### Goals (v1)

| # | Goal | Source |
|---|---|---|
| G1 | Local-first, single-driver design workspace on Celestial substrate | v2 PRD G1 |
| G2 | Persistent projects (tokens, components, routes, assets, mock data, feedback, version history) | J1, J3, J10 |
| G3 | State-preserving HMR via Vite + React Fast Refresh: <500ms p50, <800ms p95 — with explicit "this edit will cost state" warnings before hook-order / component-identity changes | v2 G3 + [fix T5] |
| G4 | Multi-route prototypes with file-system routing and auto-generated nav | J1 |
| G5 | Design system as first-class (token CRUD, referencing, OKLCH resolver, lint-enforceable) | J2, gap 5 |
| G6 | Multi-viewport stage (desktop / tablet / mobile / custom) | J6 |
| G7 | Element-anchored comments from any browser with the shared review URL | J4, gap 6 |
| G8 | Versioning with branch / diff / restore — content-addressed, git-friendly layout | J10, J11, gap 2 |
| G9 | Validation: axe-core, design-system conformance lint, time/random source AST lint | J6, gap 9, [fix T15] |
| G10 | Multi-agent design panel (5 agents dispatched via Claude Code's Task tool inside the user's interactive session) | J7, gap 10 |
| G11 | Closed-loop forge iteration (in-session, git-worktree-scoped, bounded by iter + cost) | J8, gap 11, [fix T1] |
| G12 | v1 framework export = React + Tailwind + shadcn/ui + Storybook MDX + Style Dictionary + CSS vars + Tailwind config + route map markdown. Vue / Svelte / WC are v1.2. | J9, gap 12, [fix T9] |
| G13 | Determinism: element IDs, version IDs, snapshot hashes (same-OS), exports, token resolution all content-addressed and reproducible. Cross-OS snapshot equality softened to perceptual diff (ΔE < 2.0) — not hash. | v2 G13 + [fix T3] |
| G14 | OAuth-only Claude auth via PTY-hosted interactive session — no Claude Agent SDK, no `claude -p`, no API key | OAuth bridge doc + TOS post-June-15 |

### Non-goals (v1)

| # | Non-goal | Why |
|---|---|---|
| N1 | Multiplayer real-time editing | Multiplayer is git + warp-CRDT-mediated; canvas editing is single-driver |
| N2 | Hosted SaaS mode | Local-only; tunnel via warp's SSH adapter for shared review URLs |
| N3 | Visual drag-and-drop editor | Authoring is chat + filesystem; no Figma-style canvas |
| N4 | Bidirectional Figma sync | v1 exports SD JSON Figma can import; v1.2+ bidirectional |
| N5 | Vision-based component synthesis (screenshot → JSX) | v1 takes NL + code only |
| N6 | Community component marketplace | v1 = shadcn-starter primitives + project-local components |
| N7 | Anonymous public preview URLs | v1 = localhost + warp tunnel + shared secret |
| N8 | Motion design authoring surface | Motion-as-code is fine; no dedicated authoring UI |
| N9 | Vue / Svelte / WC framework export | v1.2 |
| N10 | Lighthouse perf validation in core loop | v1.1 (Playwright is already there; integration is the work) |
| N11 | Single chat surface via SDK runtime-transfer | v3 model has chat in the browser via Celestial's existing `rift` + `lens.createBrowserMirrorSession` + `beacon-browser` surfaces — no runtime transfer needed, [fix T8 + T13] |

---

## 4. Must / should / won't-have requirements

### Must (blocks v1 ship)

- M1. PTY-hosted interactive `claude` session via `forge.createClaudeRuntime`
- M2. Browser surface via `lens.createBrowserMirrorSession` + `beacon-browser` extension chunks
- M3. Project lifecycle: create / open / list / archive
- M4. Token CRUD with referencing, OKLCH resolver, cycle detection
- M5. Component CRUD with project-scoped library (`components/<Name>/{Component,spec,tokens,a11y,stories}.{ext}`)
- M6. Route CRUD with file-system routing and HMR
- M7. Stage pane (Vite-rendered React iframe, multi-viewport)
- M8. Element-id Vite plugin injecting `data-loom-id` — robust to JSX spread and `.map()` children [fix T7]
- M9. Inline element comment overlay + posting via warp CRDT [fix T10]
- M10. Version snapshots (content-addressed Merkle) with diff / restore via `parallax`
- M11. Branch create / switch / merge with 3-way per-file, Claude resolving text conflicts
- M12. Multi-agent design panel: 5 agents dispatched via Claude Code Task tool inside user's session [fix T13]
- M13. Forge loop: in-session, `git worktree`-scoped, bounded by iter + cost caps [fix T1]
- M14. axe-core validation; time/random AST lint [fix T15]
- M15. Token-usage lint
- M16. v1 exports: CSS vars, Tailwind config, Style Dictionary JSON, React-shadcn + Storybook MDX, route map markdown
- M17. `loom-tools` MCP server (project / token / component / route / version / branch / panel / forge / export / comment tools)
- M18. Cross-platform install (macOS / Linux / Windows) via Celestial's build pipeline
- M19. Determinism: same project state → same snapshot hash (same OS). Cross-OS = perceptual diff [fix T3]
- M20. Doctor command for environment diagnosis

### Should (v1 if time permits, else v1.1)

- S1. warp-tunnel-based remote review URL (shared secret + tunnel)
- S2. Per-route review states (draft / in-review / approved)
- S3. Static-bundle export (single HTML)
- S4. Mock-data generator with seedable RNG
- S5. Dark-mode token system with `light-dark()`
- S6. Hook-order-change "this edit will cost state" warning [fix T5]

### Won't (v1)

All N1–N11.

---

## 5. Scope

### In scope

- New Celestial app at `apps/loom/`
- New Loom-owned Vite plugin under `apps/loom/src/vite-plugin-loom-ids/`
- New Loom-owned MCP server under `apps/loom/src/mcp/`
- New Loom skills under `apps/loom/skills/` (`new`, `open`, `token`, `component`, `route`, `panel`, `forge`, `branch`, `snapshot`, `review`, `export`, `doctor`, `stop`)
- New Loom agents under `apps/loom/agents/` (visual-critic, a11y-reviewer, copy-editor, brand-keeper, responsive-checker)
- New Loom commands under `apps/loom/commands/` matching skill names
- Loom-specific SQLite schemas under `<project-dir>/.loom/project.sqlite` and `~/.loom/server/server.sqlite`
- Loom-specific on-disk project layout (per §6.1)
- Loom-specific telemetry events layered onto Celestial's `ephemeris` causal ledger
- Loom-specific test fixtures under `apps/loom/test-projects/`
- Determinism CI extending Celestial's `observatory`

### Out of scope

- Anything in §3 non-goals
- Changes to Celestial's core packages (Loom composes them; doesn't modify them — if a primitive is missing, raise it as a separate Celestial PRD)
- Replacing the user's IDE
- Authentication beyond Claude's OAuth + warp's shared secret

---

## 6. Technical design: data model

### 6.1 On-disk project layout

```
<project-dir>/                          # default ~/loom/<name>
├── loom.yaml                           # project manifest
├── tokens/                             # design tokens (YAML)
│   ├── color.yaml
│   ├── typography.yaml
│   ├── spacing.yaml
│   ├── motion.yaml
│   ├── radius.yaml
│   └── theme.yaml
├── components/
│   └── Button/
│       ├── Button.tsx
│       ├── Button.spec.md
│       ├── Button.tokens.yaml
│       ├── Button.a11y.yaml
│       ├── Button.stories.mdx
│       └── Button.snapshot.png         # last canonical render
├── routes/
│   ├── _layout.tsx
│   ├── index.tsx
│   └── ...
├── mock-data/
├── assets/
│   ├── images/
│   └── fonts/                          # self-hosted for determinism
├── exports/                            # gitignored
└── .loom/                              # cache + state (most gitignored)
    ├── snapshots/                      # PNG renders, keyed by hash
    ├── validation/                     # axe / lint reports
    └── manifest-hash                   # current project content hash
```

**Reviews are NOT on disk.** Per [fix T10], inline element comments and panel findings live in the warp CRDT, replicated across review-URL participants. They sync via the warp WebSocket layer, not via git. (A snapshot of resolved reviews can be exported to `.loom/reviews-archive/<branch>-<date>.json` on user request, but the live source of truth is the CRDT.)

### 6.2 SQLite — `server.sqlite` (one global, at `~/.loom/server/`)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,                  -- ULID
  name TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_opened_at INTEGER,
  archived INTEGER DEFAULT 0
);
CREATE TABLE server_state (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- Telemetry: layered on Celestial's ephemeris ledger; this is a Loom-local mirror for quick queries
CREATE TABLE telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  project_id TEXT,
  payload_json TEXT
);
```

### 6.3 SQLite — `project.sqlite` (one per project, at `<project-dir>/.loom/`)

```sql
-- Content-addressed version graph (Merkle)
CREATE TABLE versions (
  id TEXT PRIMARY KEY,                  -- sha256 of canonical project manifest
  parent_id TEXT,
  branch TEXT NOT NULL,
  label TEXT,
  message TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT,                      -- 'claude' | 'user' | 'auto' | 'forge' | 'panel'
  files_json TEXT NOT NULL              -- {path: sha256}
);
CREATE TABLE branches (
  name TEXT PRIMARY KEY,
  head_version_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  protected INTEGER DEFAULT 0
);
CREATE TABLE file_blobs (
  hash TEXT PRIMARY KEY,                -- sha256
  size INTEGER NOT NULL,
  content BLOB NOT NULL,
  encoding TEXT NOT NULL                -- 'utf-8' | 'binary'
);
-- Validation results
CREATE TABLE validation_runs (
  id TEXT PRIMARY KEY,                  -- ULID
  version_id TEXT NOT NULL,
  route_path TEXT,
  kind TEXT NOT NULL,                   -- 'axe' | 'token-lint' | 'ds-lint' | 'deterministic-lint' | 'panel'
  report_json TEXT NOT NULL,
  ts INTEGER NOT NULL
);
-- Forge runs
CREATE TABLE forge_runs (
  id TEXT PRIMARY KEY,
  route_path TEXT NOT NULL,
  goal TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  final_confidence INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  outcome TEXT NOT NULL,                -- 'converged' | 'max-iter' | 'cost-cap' | 'aborted'
  worktree_path TEXT NOT NULL,          -- .loom/forge/<runId>/
  squash_commit_sha TEXT,
  ts INTEGER NOT NULL
);
-- Token resolution cache
CREATE TABLE token_cache (
  version_id TEXT NOT NULL,
  reference TEXT NOT NULL,
  theme TEXT NOT NULL,
  resolved_value TEXT NOT NULL,
  PRIMARY KEY (version_id, reference, theme)
);
```

**Indices to add:**
- `versions(branch, created_at)` for timeline queries
- `validation_runs(version_id, kind)` for "show latest panel result"
- `forge_runs(route_path, ts)` for per-route history

### 6.4 Token model

YAML files in `tokens/` define a tree. References use `{namespace.path}` syntax. Resolution is pure. OKLCH primary. Cycle detection at parse time.

```yaml
# tokens/color.yaml
seed:
  hue: 250
  chroma: 0.20
accent:
  primary: oklch(0.65 {seed.chroma} {seed.hue})
text:
  primary: oklch(0.20 0.02 {seed.hue})
surface:
  base: oklch(0.98 0.01 {seed.hue})
```

`resolve(ref, theme, snapshot) → string` is pure. Same inputs → same output. Cycles error at parse time naming the cycle path.

### 6.5 Element ID determinism — handles JSX spread + map children

Element ID injection by Loom's Vite plugin (`vite-plugin-loom-ids`):

```
data-loom-id = sha256(
  componentPath
  + ":" + JSON.stringify(canonicalize(staticProps))
  + ":" + jsxSpreadSourceLocation       // file:line of {...spread} if present
  + ":" + (mapKeyProp ?? null)          // stable key if inside a .map()
  + ":" + parentElementId
  + ":" + siblingIndex
).slice(0, 12)
```

Resolution rules [fix T7]:

- `staticProps` = props known at compile time, sorted, function values stripped
- If JSX spread is present, hash includes the spread expression's source location instead of resolved values
- If the element is inside a `.map()`, prefer `key` prop if provided; otherwise fall back to siblingIndex with a build-time warning
- On any element ID change, comments anchored to the old ID get flagged "stale" in the studio UI (not silently dropped)

Injected as `data-loom-id="abc123ef"` on the rendered DOM. Browser-side comment overlay reads this attribute.

### 6.6 Version model

A **version ID** is `sha256(canonical_manifest)` where `canonical_manifest` is a sorted JSON of `{path: sha256(content)}` for all source files. Same source → same version ID.

Versions form a DAG; branches are named pointers to versions. `/loom:snapshot` creates an explicit version; auto-snapshots fire on (a) successful Claude session end, (b) successful `/loom:review` pass, (c) successful `/loom:forge` convergence, (d) every 30 minutes of active editing.

Branching is git-native (`forge.exec` for git ops). 3-way merge per file; Claude resolves text conflicts via the in-session merge skill. Binary conflicts surface as a per-file decision in the studio UI.

### 6.7 Reviews — warp CRDT shape [fix T10]

Reviews are a y-doc (or equivalent CRDT structure provided by `warp/src/crdt.ts`). Logical schema:

```
review-doc/
├── threads: Map<threadId, ReviewThread>
│   ├── routePath: string
│   ├── elementSelector: string       # data-loom-id
│   ├── viewport: string
│   ├── versionId: string
│   ├── status: 'open' | 'resolved' | 'rejected'
│   ├── source: 'stakeholder' | 'panel' | 'self'
│   ├── createdAt: number
│   ├── resolvedAt: number?
│   └── messages: List<ReviewMessage>
│       ├── id: string
│       ├── author: string
│       ├── body: string
│       ├── severity: string?         # panel only
│       ├── agent: string?            # panel only
│       ├── screenshotHash: string?
│       └── ts: number
└── routeStates: Map<routePath, RouteReview>
    ├── state: 'draft' | 'in-review' | 'approved'
    ├── approver: string?
    └── updatedAt: number
```

The CRDT is hosted by the daemon's warp server; participants (the user's own studio UI + any stakeholder browser tabs joined via the review URL) sync over WebSocket. Conflict resolution is by CRDT semantics — concurrent comments on the same element merge without loss.

---

## 7. Technical design: API surface

Three transports.

### 7.1 MCP-over-stdio — `loom-tools` (Claude Code ↔ daemon)

Versioned `v1`. The MCP server registers with Claude Code via the plugin's `.mcp.json`. Selected tools (full surface is in §6.1 of the v2 PRD; reproduced compactly here):

**Project:** `project_create(name, path?, template?)`, `project_open(name|id)`, `project_list()`, `project_archive(id)`, `project_current()`.

**Tokens:** `token_get(ref, theme?)`, `token_set(ref, value, theme?)`, `token_list(namespace?)`, `token_resolve_all(theme)`.

**Components:** `component_create(name, spec)`, `component_get(name)`, `component_list(filter?)`, `component_update(name, patch)`, `component_delete(name)`, `component_snapshot(name, viewport?)`, `component_promote(fromArtifact, name)`.

**Routes:** `route_create(path, body, meta?)`, `route_get(path)`, `route_list()`, `route_update(path, patch)`, `route_delete(path)`, `route_screenshot(path, viewport, theme?)`.

**Mock data:** `mockdata_create(name, schema, seed?)`, `mockdata_bind(route, name, alias?)`.

**Versions / branches:** `version_snapshot(label?, message?)`, `version_list(limit?)`, `version_diff(from, to)`, `version_restore(id, mode)`, `branch_create(name, from?)`, `branch_switch(name)`, `branch_list()`, `branch_merge(from, into)`.

**Validation:** `validate(scope, kinds[])` where `kinds ∈ {axe, token-lint, ds-lint, deterministic-lint, panel}`.

**Panel:** `panel_run(scope, agents[], focus?)` — dispatches 5 Task subagents inside the calling Claude session; returns `PanelReport`. `panel_apply_fix(findingId)`. `panel_defer(findingId, reason?)`.

**Forge:** `forge_run(routePath, goal, opts?)` — creates `git worktree` at `.loom/forge/<runId>/`, runs in-session loop. `forge_abort(runId)`. `forge_squash(runId)`.

**Reviews:** `review_threads_list(routePath?, status?)`, `review_thread_get(id)`, `review_thread_resolve(id, resolution)`. The CRDT itself is browser-side; these tools read snapshots.

**Export:** `export(target, outDir)` where `target ∈ {css-vars, tailwind, style-dictionary, react-shadcn, storybook-mdx, route-map-md, static-bundle}`. (v1.2 adds `vue-uno`, `svelte5`, `web-components`.)

**Server control:** `server_status()`, `stage_url(routePath?, viewport?, theme?)`, `stage_open(routePath?)`.

**Diagnostics:** `doctor()`, `logs(since?, level?, limit?)`.

### 7.2 HTTP + WebSocket (browser surfaces ↔ daemon)

Reused from Celestial's `claude-wrapper/src/browser-session.ts` pattern. Loom adds two browser-surface chunks via `beaconBrowserExtension`:

- **Stage pane chunk** — renders the multi-viewport iframe wrapper around the Vite preview. Subscribes to `route_changed`, `render_complete`, viewport changes.
- **Inspector chunk** — file tree, version timeline, comment overlay, panel results. Subscribes to `version_snapshot`, `panel_finding`, `review_thread_*` CRDT events.

WebSocket events Loom owns (added to Celestial's existing event bus):
- `route_changed` — file watcher fired on a route or component edit
- `version_snapshot` — new version committed
- `panel_finding` — streaming finding during a panel run
- `forge_iteration` — streaming iteration during a forge run
- `forge_complete` — terminal forge event
- `validation_complete` — axe / lint / ds-lint finished
- `review_thread_added` / `review_thread_resolved` — CRDT events bubbled

REST routes Loom owns under `/api/loom/*`:
- `GET /api/loom/preview/:projectId/:routePath?viewport=&theme=` — Vite-proxied
- `GET /api/loom/snapshot/:hash` — deterministic PNG by hash
- `GET /api/loom/version/:versionId/manifest.json` — version manifest
- `POST /api/loom/review/url` — generate or rotate review-share URL
- `GET /api/loom/healthz`

### 7.3 File-watch (any editor → daemon)

`chokidar`-based, debounced 100ms, on `<project-dir>/{loom.yaml,tokens,components,routes,mock-data,assets}`. On change:

1. Recompute file blob hashes.
2. Recompute project manifest hash.
3. If changed: enqueue auto-snapshot per §6.6.
4. Notify Vite (HMR fires).
5. Broadcast `route_changed` over WebSocket.

**Invariant:** writes from Claude via MCP tools touch the filesystem, then flow through the same watch path. No separate in-memory state that diverges from disk.

---

## 8. Technical design: integration points

### 8.1 Upstream (things Loom depends on)

All Celestial-internal except where noted.

| Integration | Source | Why | Failure mode |
|---|---|---|---|
| Node.js | ≥22 LTS (Celestial's `.nvmrc`) | Runtime | Hard fail at install; doctor checks |
| Claude Code | ≥1.0 | Chat surface | Documented prereq |
| `forge` (Celestial) | `@celestial/forge` workspace:* | PTY hosting Claude, hook events, IPC, MCP relay, OSC133, graceful shutdown | Pinned to Celestial workspace version |
| `lens` (Celestial) | `@celestial/lens` | Browser mirror session, visual capture | Same |
| `portal` (Celestial) | `@celestial/portal` | HTML/CSS browser rendering, mirror server | Same |
| `beacon` + `beacon-browser` (Celestial) | `@celestial/beacon`, `@celestial/beacon-browser` | MCP rendering toolkit | Same |
| `rift` (Celestial) | `@celestial/rift` | Browser-compatible terminal renderer | Same |
| `warp` (Celestial) | `@celestial/warp` | Review CRDT + WebSocket + SSH tunnel adapter | Same |
| `parallax` (Celestial) | `@celestial/parallax` | Diff viewer for version comparison | Same |
| `ephemeris` (Celestial) | `@celestial/ephemeris` | Causal event ledger for telemetry | Same |
| `observatory` (Celestial) | `@celestial/observatory` | PTY scenario validation for determinism CI | Same |
| `nebula`, `constellation`, `horizon`, `corona`, `gravity`, `aurora` | Celestial UI stack | Studio UI primitives if/when surface needs TUI | Same |
| Vite | 5.x | Project-scoped dev server + HMR + React Fast Refresh | Pinned |
| `better-sqlite3` | 11.x | Sync, fast, deterministic SQLite | Native build; install rebuilds |
| `chokidar` | 3.x | File watching | Polling fallback |
| `axe-core` | 4.x | A11y validation | Bundled |
| Playwright + Chromium | 1.40+ | Snapshots, panel responsive-checker, forge renders | Heavy; install prompts before Chromium download |
| `oklch-string` or equivalent | latest | OKLCH color math | Pinned |

### 8.2 Downstream surfaces

- MCP server (stdio) — Claude Code
- HTTP/WS — studio UI surfaces (composed via beacon-browser) and stakeholder browsers (via warp tunnel)
- File-system layout — user's git, any editor, downstream tooling
- Exports — production codebases, Style Dictionary pipelines, Figma plugins that read SD

### 8.3 Third-party (optional)

- Cloudflare Tunnel — via warp's SSH adapter for remote review URLs
- Claude Code's other MCPs (Linear, Asana, Slack, etc.) — v1.1 live data binding
- Figma REST API — v1.2 read-only token import; v2 bidirectional

---

## 9. Technical design: sequence flows + failure modes

### 9.1 Cold start: first project (≥1 of 7)

```
User: claude (in any directory)
  └─ Loom plugin loads (skills + agents + MCP)

User: /loom:start
  └─ Plugin checks ~/.loom/server/pid; absent → spawn
     └─ Daemon spawns:
        - forge.createClaudeRuntime → spawns interactive `claude` in PTY [G14]
        - lens.createBrowserMirrorSession → browser surface ready
        - beacon-browser extension serves Loom chunks (stage, inspector, etc.)
        - Fastify on :5174 (or next free port)
        - SQLite open
        - chokidar idle
     └─ Daemon writes pid + port to ~/.loom/server/
     └─ Returns to Claude: { port, stageUrl }
  └─ Claude tells user: "Server up at http://localhost:5174/loom"

User: /loom:new "billing-redesign" --template shadcn-starter
  └─ MCP: project_create
     └─ Daemon writes loom.yaml, tokens/, components/, routes/, .loom/
     └─ Initial git commit
     └─ Initial version row in project.sqlite (label='init')
     └─ Per-project Vite dev server starts on dynamic port
  └─ Daemon broadcasts `stage_url` event
  └─ Claude tells user URL + opens browser via stage_open
```

### 9.2 Edit loop: Claude writes a component (≥2)

```
Claude: component_create({ name: 'Button', spec: {...} })
  └─ MCP: writes components/Button/{Button.tsx, Button.spec.md}
     └─ chokidar fires → recompute manifest hash → diff against last
     └─ Vite HMR fires → Button preview updates without scroll loss
     └─ Daemon broadcasts route_changed via WS
     └─ Throttled auto-snapshot scheduler advances clock
```

### 9.3 Stakeholder comments on a live element (≥3)

```
Stakeholder opens https://<warp-tunnel-host>/loom/<projectId>/preview/dashboard
  └─ warp.ws-client connects, syncs CRDT
  └─ User clicks element → reads data-loom-id → opens compose form
  └─ CRDT update: { threads[new] = {routePath, elementSelector, body, ...} }
  └─ Daemon (CRDT host) receives update, replicates to other clients
  └─ User's studio UI: inspector shows new comment, toast appears
  └─ If `notify_on_review` is on in loom.yaml, Claude session gets a system notice
```

### 9.4 Multi-agent design panel (≥4)

```
User: /loom:panel landing-page
  └─ Claude invokes panel skill
     └─ Reads loom.yaml + tokens.json + active artifact
     └─ Dispatches 5 Task tool calls in parallel:
        - visual-critic    (file-scoped read)
        - a11y-reviewer    (file-scoped read + Playwright for contrast computation)
        - copy-editor      (file-scoped read of JSX text)
        - brand-keeper     (file-scoped read + tokens AST walk)
        - responsive       (Playwright 4-viewport render)
     └─ Each agent returns findings via Task return
     └─ Claude main thread synthesizes, writes to validation_runs + warp CRDT
  └─ Studio UI inspector: animates findings into Reviews tab live
```

### 9.5 Closed-loop forge (≥5) [fix T1]

```
User: /loom:forge --route /pricing --goal "three distinct moments"
  └─ Claude invokes forge skill
     └─ Precondition: `git status --porcelain` must be empty → else refuse [fix T1]
     └─ git worktree add .loom/forge/<runId> <currentBranch>
     └─ Insert forge_runs row (outcome=running)
     └─ For each iteration i in 1..6:
        a. Playwright renders inside the worktree at 1440x900 and 390x844
        b. Task subagent (visual-critic-with-goal) proposes one targeted edit
        c. Edit tool applies edit in worktree path
        d. Playwright re-renders
        e. Task subagent (judge, Haiku-default) scores 0-100
        f. If confidence < 60: revert worktree HEAD, retry once with different edit
        g. If confidence ≥ 90: break early
        h. Stream forge_iteration via WS
     └─ On completion: surface "merge worktree → branch? squash N commits?"
        - On merge: git merge --squash .loom/forge/<runId> into <currentBranch>
        - On discard: git worktree remove .loom/forge/<runId> --force
     └─ Update forge_runs row (outcome=converged|max-iter|cost-cap|aborted)
```

### 9.6 Failure modes (≥10 — bar is ≥5)

Combined from v2 PRD failure-mode table, adversarial-review findings, and new modes specific to v3 architecture.

| # | Failure | Detection | Mitigation |
|---|---|---|---|
| F1 | Daemon crash mid-session | PID present, port dead | Plugin's session-start hook restarts; project state preserved on disk; CRDT survives in client browsers |
| F2 | Vite port conflict | Vite binds next free | Daemon probes; studio loads new URL via WS |
| F3 | File watcher misses change (edge FS) | Manifest hash unchanged after expected edit | Polling fallback; doctor warning |
| F4 | Concurrent edits collide | Two writes within 200ms | Last-write-wins on disk; Claude raises explicit warning; user can branch |
| F5 | Token cycle | Visited-set during resolve | Parse-time error naming cycle path |
| F6 | Playwright render crash | `pageerror` event | Snapshot marked failed; live route still served |
| F7 | Validation timeout | 30s per-route default | Returns partial report; re-runnable |
| F8 | SQLite corruption | `better-sqlite3` throws | Quarantine + auto-backup restore (every 100 versions) |
| F9 | Same-OS snapshot determinism breaks | Determinism CI hash mismatch | Surfaced in doctor; pinned fonts; documented Playwright flags |
| F10 | Cross-OS hash mismatch | Expected per [fix T3] | Perceptual diff comparison only across OSes — not a failure |
| F11 | Shared secret leaked | Out of scope to detect | User rotates via `/loom:review url rotate`; CRDT participants forced to re-auth |
| F12 | Panel agent contradiction | Synthesis sees overlapping severity | Surface contradiction explicitly; recommend token revision discussion |
| F13 | Forge exhausts budget without converging | Iteration count == max-iter AND confidence < 90 | Return best-confidence state; squash optional; transcript surfaces what was tried |
| F14 | Forge precondition violated (dirty working tree) | `git status --porcelain` non-empty | Skill refuses to run; tells user to commit/stash first [fix T1] |
| F15 | Panel agent dies mid-run | Task subagent error | Synthesis runs with N–1; missing agent flagged in report header [fix carry-over] |
| F16 | Hook-order-changing edit will lose state | AST analysis at edit-time | Warn user before write; option to "save state first" via auto-snapshot [fix T5] |
| F17 | Time/random source in component file | AST lint at file save | Lint flags Date.now / Math.random / crypto.randomUUID; suggests seeded alternative [fix T15] |
| F18 | JSX spread breaks element ID stability | Vite plugin detects spread | Hash spread source location; comment-anchoring stable across runs [fix T7] |
| F19 | warp CRDT divergence (network partition) | CRDT epoch mismatch | y-doc style merge; user notified of merge in inspector |
| F20 | Memory burst during panel (5 parallel Tasks) | Process memory monitor | Cap parallelism at 5; document 16GB RAM floor [fix T6] |
| F21 | OAuth re-auth mid-session in browser PTY | Claude prints re-auth URL to PTY | URL captured by daemon, surfaced as toast in studio UI; user opens in separate tab; PTY continues after auth |

---

## 10. Technical design: feature flags + telemetry + metrics

### 10.1 Feature flags

Set per-project in `loom.yaml::features:` or globally in `~/.loom/config.yaml`.

| Flag | Default | Purpose |
|---|---|---|
| `panel_default_agents` | `[visual, a11y, copy, brand, responsive]` | Customizable panel composition |
| `forge_max_iters` | 6 | Hard ceiling per run |
| `forge_max_cost_usd` | 0.50 | Hard ceiling per run |
| `forge_judge_model` | `haiku` | Fallback to `sonnet` if judge accuracy insufficient |
| `auto_snapshots` | on | Some users prefer manual only |
| `lighthouse_validation` | off (v1.1) | Wires Lighthouse |
| `live_data_bindings` | off (v1.1) | Wires Claude Code's other MCPs |
| `tunnel_mode` | off | Enable warp SSH-adapter tunnel for remote review URLs |
| `playwright_install_prompt` | on | Chromium download confirmation |
| `hook_order_change_warning` | on | Surface "this edit will cost state" before agent applies [fix T5] |
| `deterministic_lint` | on | Flag Date.now/Math.random/crypto.randomUUID in components [fix T15] |

### 10.2 Telemetry events (local SQLite + ephemeris causal ledger)

Every event: `ts`, `event_type`, optional `project_id`, optional `payload_json`. Layered onto Celestial's existing `ephemeris` ledger for causal traceability.

- **Lifecycle:** `server_start`, `server_stop`, `server_crash`, `project_open`, `project_create`
- **Editing:** `token_set`, `component_create`, `component_update`, `route_create`, `route_update`, `component_promoted`
- **Versioning:** `snapshot_created`, `branch_created`, `branch_switched`, `merge_resolved`, `merge_conflict`
- **Validation:** `validation_run`, `validation_pass`, `validation_fail`
- **Panel:** `panel_run`, `panel_finding_applied`, `panel_finding_deferred`, `panel_agent_failed`
- **Forge:** `forge_run_start`, `forge_iteration`, `forge_run_complete`, `forge_run_aborted`
- **HMR:** `hmr_event` (sampled)
- **Export:** `export_completed`
- **Reviews:** `review_thread_added`, `review_thread_resolved`, `review_url_generated`
- **Health:** `doctor_run`, `hook_timeout`, `mcp_tool_error`

### 10.3 Metrics (named + sampled targets)

**Performance — targets sampled from a 30-minute session on a 16GB M-series Mac:**

| Metric | Target p50 | Target p95 | Evidence requirement |
|---|---|---|---|
| `time_to_preview` (cold start → first preview live) | ≤5s | ≤12s | doctor-run timestamp pairs |
| `hmr_latency` (file save → browser repaint) | ≤300ms | ≤800ms | HMR event log |
| `snapshot_render_time` (per route) | ≤2s | ≤6s | snapshot-cache entries |
| `validation_axe` (per route) | ≤3s | ≤8s | validation_runs.ts deltas |
| `panel_run_duration` | ≤30s | ≤60s | Phase 2 exit gate |
| `panel_run_cost` | ≤$0.10 | ≤$0.30 | per-run billing record |
| `forge_run_duration` (6-iter ceiling) | ≤3min | ≤6min | forge_runs.ts deltas |
| `forge_run_cost` | ≤$0.40 | ≤$0.50 | per-run billing record |
| `memory_resident_during_panel` | ≤1GB | ≤1.5GB | OS RSS samples [fix T6] |

**Reliability:**

| Metric | Target | Evidence requirement |
|---|---|---|
| `crash_free_session_rate` | ≥99% over 1000 sessions | session_end events |
| `hmr_success_rate` (edit triggers visible change without manual reload) | ≥95% | hmr_event + render telemetry |
| `same_os_determinism_check_pass_rate` | 100% | Determinism CI run |
| `cross_os_perceptual_diff_pass_rate` (ΔE < 2.0) | ≥98% | Determinism CI cross-OS matrix [fix T3] |
| `forge_convergence_rate` (confidence ≥75 within budget) | ≥70% on calibrated test set | Phase 0 calibration: 5 canned routes, 3 human scorers, judge correlation r>0.6 [fix T2] |
| `panel_actionable_rate` (findings applied vs. deferred per artifact) | ≥70% applied | Phase 2 exit gate |

---

## 11. Performance + security + rollout plan

### 11.1 Performance

- **Server cold start:** Fastify + better-sqlite3 + Celestial's forge runtime: <1s on M-series, <1.5s on mid-spec Windows. Lazy-load Playwright until first snapshot/validation/panel/forge.
- **Vite warm-up:** First request to a route triggers dependency optimization; warm requests <50ms. Pre-warm top 5 routes on `project_open`.
- **SQLite:** WAL mode, busy_timeout 5s, single writer per project, `synchronous=NORMAL`. Filesystem is source of truth.
- **File watcher:** chokidar debounced 100ms, batched into single HMR event.
- **Memory budget:** 500MB idle, 1GB during panel, 1.5GB worst-case during forge with 5-agent panel running back-to-back. Documented hardware floor: 16GB RAM recommended [fix T6].
- **Snapshot cache:** content-addressed by `(route, viewport, theme, versionId)`. Hit rate target >90% on repeats.
- **Export determinism:** pure function of `(versionId, target, options)`. Cached under `.loom/exports/<hash>/`.
- **Multi-project memory budget:** cap active projects at 5. `project_open` 6th returns error suggesting archive [fix T11].

### 11.2 Security + privacy

- **Default bind:** `127.0.0.1` only. Tunnel mode (warp SSH adapter) requires explicit opt-in.
- **Shared-secret auth** for warp review URLs. Secret in `<project-dir>/.loom/secret` (mode 600), rotatable.
- **No remote telemetry.** All in local SQLite + ephemeris ledger.
- **CSP for studio UI:** strict; only Vite HMR WS, project preview iframe, self-hosted fonts.
- **Sandboxed stage iframe:** `sandbox="allow-scripts allow-same-origin"` from separate port to limit cross-frame interference.
- **Asset uploads:** validated by ext + MIME sniff; max 10MB per file; served only from `<project-dir>/assets/`.
- **MCP tool boundaries:** loom-tools read-only outside project dir + Loom's data dir. Cannot exfiltrate user files.
- **Determinism as defense:** content-addressed versions detect tampering.
- **OAuth-only Claude auth:** PTY-hosted interactive session [G14]. No API key required, no `claude -p`, no SDK. TOS-compliant interactive use.

### 11.3 Rollout technical plan

Five phases, ~14 weeks net-new work, plus integration overhead. See §14 for full phase gate detail.

| Phase | Weeks | Net new (vs. Celestial-substrate) | Exit gate |
|---|---|---|---|
| 0 — Spike | 1 | Scaffold `apps/loom/`, prove `forge.createClaudeRuntime` + Loom Vite plugin work end-to-end | HMR working; Haiku-judge calibration ≥r=0.6 on 5-route test set |
| 1 — MVP | 3 | Project + token + component + route MCP + studio UI panes + axe-core + token lint + CSS-vars/Tailwind/SD/React-shadcn export | Real prototype built end-to-end; ≤1 manual workaround/session |
| 2 — Review + panel | 4 | Element-id Vite plugin + comment overlay (beacon-browser chunk) + warp CRDT for reviews + 5-agent panel skill | External reviewer comments on 5 routes unaided; panel ≥3 actionable findings/artifact, <30% defer rate |
| 3 — Branch + forge | 2 | parallax-composed diff + forge skill with git-worktree scaffold | Solo user runs 2 directions and merges; forge converges on real goal in ≥3 of 5 trials |
| 4 — Hardening | 3-4 | Cross-OS install (Win/Linux/Mac); Doctor; determinism CI with same-OS hash + cross-OS perceptual diff | Install → demo project → export → drop into production React codebase, no manual intervention |

**Rollback strategy:** Loom is a Celestial app, version-controlled in the monorepo. Rollback = `git revert <phase-commit>` per the Celestial commit-discipline rule. Project files on disk remain openable by prior versions. SQLite migrations are forward-compatible within v1.x.

---

## 12. Risks (severity × likelihood)

Eleven risks; cross-mapped to adversarial findings.

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | React Fast Refresh state loss under agent edits [T5] | Medium | High | `hook_order_change_warning` flag on by default; AST scan warns user pre-write; auto-snapshot before risky edits |
| R2 | Same-OS determinism breaks (font / render variance) [T2/T3] | High | High | Pin self-hosted fonts; Playwright `--font-render-hinting=none`; same-OS determinism CI in Phase 0 |
| R3 | Memory budget overruns on panel + forge stacking [T6] | Medium | Medium | 5-cap parallelism; profile in CI; document 16GB floor |
| R4 | Plugin install / Node version mismatch on Windows | High | Medium | Doctor; documented prereq; Celestial's install script |
| R5 | Claude Code MCP tool surface drifts | Low | High | Track release notes; integration tests; v2 surface ready before deprecation |
| R6 | Shared-secret weak for public review URLs | Medium | Medium | Default localhost; tunnel requires opt-in + warnings; rotate on demand |
| R7 | Playwright Chromium download (>200MB) deters first-run | High | Medium | Opt-in; Chromium install only on first need with prompt |
| R8 | Auto-snapshot 30-min throttle loses work in edge cases | Medium | Medium | Snapshot on every panel/forge run; explicit `/loom:snapshot` always works |
| R9 | Solo-maintainer surface [T16] | Medium | High | Celestial substrate compresses to ~14 weeks net-new; phase plan pre-declares cut list (Vue/Svelte/WC, Lighthouse, live data) |
| R10 | Forge judge (Haiku) accuracy fails calibration [T2] | Medium | High | Phase 0 calibration: 5 canned routes, 3 human scorers, judge correlation r>0.6 required to proceed; fallback to Sonnet behind flag |
| R11 | Anthropic adds anti-multiplexing detection or revokes interactive OAuth for browser PTY (TOS shift) | Low | High | Fallback: revert to terminal-only chat per OAuth bridge doc §5; opt-in API-key mode for users who want headless |

---

## 13. Acceptance criteria (given / when / then)

Thirteen criteria. Inherits v2 PRD's ten, plus three from this synthesis.

1. **Cold start.** Given a fresh install on a supported OS (macOS 13+, Ubuntu 22+, Windows 11), When the user runs `/loom:start`, Then the server is up at `localhost:5174` within 12s and the studio UI loads.

2. **HMR.** Given an open project with at least one route, When Claude calls `route_update`, Then the user's open browser shows the change within 800ms without losing scroll or component state — provided the edit respects Fast Refresh boundaries.

3. **Hook-order warning.** Given an edit that would change hook order, When Claude proposes it, Then the user receives a "this edit will cost state" warning before the file is written, with an option to auto-snapshot first.

4. **Determinism (same-OS).** Given a project with 5 routes, When the user runs `/loom:snapshot` twice without changes on the same OS, Then both snapshots produce the same version ID AND the same per-route snapshot hash.

5. **Determinism (cross-OS).** Given the same project state on macOS and Linux, When snapshots are rendered for the same `(route, viewport, theme)`, Then the ΔE perceptual diff is <2.0 (hash equality is not required cross-OS).

6. **Stakeholder feedback.** Given a stakeholder joins via warp review URL, When they click an element and submit a comment, Then the comment appears in the studio UI within 2s and is anchored to the same element across re-renders until the element ID changes.

7. **Stale comments.** Given a comment is anchored to a `data-loom-id` and the component is edited such that the ID changes, Then the comment is flagged "stale" in the inspector, never silently dropped.

8. **Token lint.** Given a project with tokens defined, When Claude calls `validate('ds-lint')`, Then any component using a raw color outside the token graph is flagged with file + line.

9. **Deterministic-source lint.** Given a project component file uses `Date.now()`, `Math.random()`, or `crypto.randomUUID()`, When `deterministic_lint` validation runs, Then the file is flagged with file + line + suggested seeded alternative.

10. **Branch merge.** Given two branches with divergent changes, When the user runs `/loom:branch merge feature-a into main`, Then non-conflicting files merge automatically; conflicts surface in Claude with a per-file resolution prompt.

11. **Forge data safety.** Given a project with uncommitted changes in the working tree, When the user runs `/loom:forge`, Then the skill refuses to start and tells the user to commit or stash. When the working tree is clean and forge runs, all iterations happen in `.loom/forge/<runId>/` git worktree — the user's working tree is physically untouched.

12. **Forge convergence.** Given a route with deliberately flat hierarchy and a clear goal, When the user runs `/loom:forge --max-iters 6`, Then the run completes within budget (≤6 iter, ≤$0.50), produces final confidence ≥75 on calibrated goals, and writes a transcript of attempts.

13. **Panel non-noisy.** Given a real artifact and `/loom:panel`, When the run completes within 60s, Then ≥3 findings are produced and the user-applied vs. deferred ratio is ≥70% applied on the calibrated test set.

14. **Export round-trip.** Given a project with 3 components and 2 routes, When the user runs `/loom:export react-shadcn --out ./exports/<x>`, Then the export builds (`npm install && npm run build`) and rendered output is visually equivalent (ΔE <2.0 same-OS) to the studio preview.

15. **Server recovery.** Given the server is running and Claude Code is killed abruptly, When a new Claude Code session starts, Then the existing server is detected (PID + port) and reused; the prior project remains open.

16. **OAuth-only.** Given a user with Claude Pro/Max OAuth but no API key, When they run the full Loom session lifecycle (start, new project, snapshot, panel, forge, export, stop), Then no API key is required at any step and no `claude -p` invocation occurs.

---

## 14. Rollout plan with phase gates

| Phase | Gate | Go criteria | No-go action |
|---|---|---|---|
| 0 → 1 | Spike works | (a) `forge.createClaudeRuntime` runs `claude` in PTY end-to-end; (b) Loom Vite plugin injects `data-loom-id` on a real component; (c) determinism harness same-OS passes 3x; (d) Haiku judge calibration r>0.6 on 5-route test set | If (a)-(c) fail: redesign substrate choice. If (d) fails: lock Sonnet judge into plan + halve forge budget to $0.25 |
| 1 → 2 | MVP dogfood | One real prototype built end-to-end via Claude; ≤1 manual workaround per session; v1 React-shadcn export builds standalone | Reduce panel scope to 3 agents (visual + a11y + brand); push tunnel to v1.1; rerun MVP gate |
| 2 → 3 | Review + panel | External reviewer comments on 5 routes unaided; warp CRDT survives 30-min concurrent-edit fuzz test; panel ≥3 actionable findings/artifact with ≥70% applied rate on calibrated test set | Drop responsive-checker agent (heaviest cost); reduce panel surface to 4 agents; rerun |
| 3 → 4 | Branch + forge | Solo user runs 2 directions and merges in a real project; forge converges on calibrated goal in ≥3 of 5 trials; git-worktree precondition test passes (refuses dirty tree) | Reduce forge to "manual advance" mode (`/loom:forge step` per iteration); defer auto-loop to v1.1 |
| 4 → ship | Hardening | Cross-OS install green on Mac+Linux+Win; same-OS determinism CI green; cross-OS perceptual diff CI green; React-shadcn export round-trip verified into a production Next.js app | Hold for the failing OS or dimension |
| v1.1 | Vue/Svelte/WC + Lighthouse + live data bindings + Figma read | Each behind feature flag; existing users opt-in cleanly | Stay v1.0 |

---

## 15. Validation plan

Five validators, each with explicit exit commands. Per skill convention, validation includes commands run + expected output.

### V1 — Self-check this PRD against schema

```bash
# Required sections (16). Expect all present.
for section in "Problem statement" "Users + jobs" "Goals + non-goals" "Must/should/won" \
               "Scope" "data model" "API surface" "integration points" \
               "sequence flows" "feature flags" "Performance" "Risks" \
               "Acceptance criteria" "Rollout" "Validation plan" "Open"; do
  grep -q "$section" loom-prd-v3.md && echo "OK: $section" || echo "MISSING: $section"
done

# At least 5 failure modes
grep -cE "^\| F[0-9]+" loom-prd-v3.md  # expect ≥10 (we have 21)

# At least 13 acceptance criteria
grep -cE "^[0-9]+\. \*\*[A-Z]" loom-prd-v3.md  # expect ≥13 in §13

# Every adversarial fix is mapped
grep -cE "\[fix T[0-9]+\]" loom-prd-v3.md  # expect ≥10 (one per fix)
```

### V2 — Phase 0 spike

Scaffold `apps/loom/`. Compose `forge.createClaudeRuntime` + a stub Vite plugin. Write one React component with a tokens reference. Verify:
- `claude` runs interactively inside PTY (OAuth works)
- Browser renders the stage iframe
- HMR fires on file save
- Same project state → same manifest hash (3 runs)
- Same `(version, route, viewport, theme)` → same snapshot hash (same OS)

### V3 — Haiku-judge calibration (forge gate)

Five canned routes with explicit subjective goals ("three distinct moments", "tighter visual rhythm", "more confident hierarchy", "warmer brand voice", "denser information density"). Three human reviewers score each on 0-100. Run Haiku judge against each. Compute Pearson correlation. Require r > 0.6 to proceed; else swap Sonnet and re-cost the forge phase.

### V4 — Adversarial red-team

Run `ultraprompt:adversarial` against `loom-prd-v3.md`. Expected: most v2-era findings should now resolve or substantially soften. New findings (specific to v3 architecture) get logged as open questions or new risks.

### V5 — Risk-and-controls review

For warp tunnel mode + shared-secret + cross-machine review URLs, dispatch `ultraprompt:risk-and-controls-reviewer`. Acceptance: explicit confirmation that the tunnel + secret model is acceptable for v1's "internal stakeholder review" use case, and that public-internet exposure is correctly gated behind a documented opt-in flag.

---

## 16. Open product questions + open technical questions

### Product

1. **Default starter design system.** v1 ships `shadcn-starter` (neutral). Should v1.2 add `loom-bold` for demos?
2. **Auto-trigger forge after panel.** "I fixed the panel issues; verify with a forge pass." Yes for v1.1?
3. **Custom panel agents from community plugins.** v1 ships 5; v1.2+ allows publishing as plugin agents.
4. **Multi-driver model.** v1 = single driver. v1.1+ may add file-level locks via the daemon. Does the warp CRDT's review surface change the calculus on this?
5. **Storybook in v1 export.** Confirmed must in §G12; verify `*.stories.mdx` round-trip cleanly with current Storybook 8.

### Technical

1. **Studios primitives reuse.** Read `claude-wrapper/src/studios/` (modal-studio, overlay-studio, studio-preview, studio-property-panel, studio-code-gen, studio-primitives, studio-transitions, studio-types) in Phase 0 — they likely compress Loom's inspector/preview pane work further than this PRD assumes.
2. **Element-id stability under refactor.** Component rename invalidates all IDs. v1 = comments flagged stale. v1.1 = semantic rewrite tool (tied to TS rename refactor)?
3. **Token lint accuracy.** False positives on data-uri SVG. Add `// loom-ignore-next-line` escape hatch in v1.
4. **OAuth re-auth flow inside browser PTY.** If the user's Claude OAuth token expires mid-session, Claude prints a re-auth URL to the PTY. Validate in Phase 0 that the daemon captures this URL and surfaces it cleanly in the studio UI.
5. **Multi-project Vite memory.** Cap at 5 per §11.1. If telemetry shows users frequently hit the cap, consider sharing a single Vite instance with project-routed config (more complex; defer).
6. **CRDT snapshotting.** When a stakeholder leaves and re-joins a warp review URL, what's the rejoin protocol? warp probably handles this; verify in Phase 2.
7. **Plugin distribution as separate npm.** v1 lives in Celestial monorepo. v1.1 publishes plugin variant via `plugin-sdk`. Confirm the SDK supports the Vite-plugin + MCP-server + browser-chunks shape that Loom needs.
8. **Determinism under animations.** Components with CSS transitions or JS-driven motion produce non-deterministic snapshots if captured mid-animation. Solution: snapshot delays default to `animation-delay: 0; animation-duration: 0` via Playwright option. Verify Phase 0.
9. **Forge judge model fidelity (post-calibration).** If r=0.6 calibration holds, document the test set publicly so users can extend it for their own subjective goals. If r<0.6, swap to Sonnet and document the cost.
10. **Element-id Vite plugin perf.** AST-walking every JSX file on every HMR may slow large projects. Plan: cache by file content hash; only re-walk changed files. Validate at scale in Phase 4.

---

## Appendix A — Provenance table

For traceability per skill discipline: every goal traces to a product driver or tech driver; every technical decision traces to a product driver or carries a `[tech-only]` flag.

| Section | Origin | Driver |
|---|---|---|
| §1 problem | v2 PRD §1 + Claude Design 2026 launch | Gap audit + competitor evidence |
| §2 personas | v2 PRD §2 | Maintained from v1 |
| §3 G1 | v2 G1 | Local-first principle |
| §3 G2 | J1, J3, J10 | Persistent project |
| §3 G3 | v2 G3 + [fix T5] | HMR + state-warning |
| §3 G4 | J1 | Multi-route prototypes |
| §3 G5 | J2 + gap 5 | Design system first-class |
| §3 G6 | J6 | Multi-viewport |
| §3 G7 | J4 + gap 6 | Element comments |
| §3 G8 | J10, J11, gap 2 | Versioning |
| §3 G9 | J6, gap 9, [fix T15] | Validation + det-lint |
| §3 G10 | J7, gap 10 | Multi-agent panel |
| §3 G11 | J8, gap 11, [fix T1] | Forge loop in-session, worktree-scoped |
| §3 G12 | J9, gap 12, [fix T9] | Export, React-shadcn only v1 |
| §3 G13 | v2 G13 + [fix T3] | Determinism (cross-OS softened) |
| §3 G14 | OAuth bridge doc | PTY-only Claude auth |
| §6.5 elt ID rules | [fix T7] | Spread + map handling |
| §6.7 reviews CRDT | [fix T10] | Replaces YAML-append |
| §9.5 forge | [fix T1] | Git worktree |
| §9.6 F16 | [fix T5] | Hook-order warning |
| §9.6 F17 | [fix T15] | Deterministic source lint |
| §9.6 F18 | [fix T7] | JSX spread |
| §9.6 F20 | [fix T6] | Memory cap |
| §11.1 mem floor | [fix T6] | 16GB |
| §11.2 OAuth | G14, OAuth bridge | TOS compliance |
| §10.3 metrics | Calibration / [fix T2] | Forge gate r>0.6 |
| §13 AC11 | [fix T1] | Forge data safety |
| §13 AC9 | [fix T15] | Det lint AC |
| §13 AC3 | [fix T5] | Hook-order warning AC |
| §13 AC16 | G14 | OAuth-only AC |
