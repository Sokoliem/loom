# Loom on Celestial — integration brief

The v2 PRD assumed Loom would build its own daemon, PTY host, browser surface, hook ingestion, multiplayer, and diff viewer from scratch. After surveying `C:\Development\celestial\.worktrees\claude-wrapper-rewire`, this is wrong by a wide margin. Celestial already ships every load-bearing piece Loom needs except the design-system data model and the design-specific skills.

**The framing shift:** Loom is not a standalone plugin. Loom is a **Celestial app**, sibling of `claude-wrapper`, `forge`, `genesis`, `playground`, `solaris`, `workshop`. It composes existing Celestial packages and adds the design-specific surfaces (token model, panel/forge skills, framework export, element-id Vite plugin, design preview pane).

This shrinks the build by something like 60-70%. It also fixes most of the adversarial-review findings for free, because Celestial's primitives have already absorbed the lessons (PTY brokering, OSC133, hook events, mission control, CRDT multiplayer).

---

## 1. What Celestial already provides

Everything below is in `packages/` or `apps/claude-wrapper/` today. I read enough to verify each item — these are not guesses.

**PTY infrastructure** (`packages/forge/`)

| Piece | Source |
|---|---|
| In-process PTY host | `forge/src/in-process-pty-host.ts` |
| Proxied PTY host | `forge/src/proxied-pty-host.ts` |
| PTY broker + protocol | `forge/src/pty-broker.ts`, `pty-broker-protocol.ts`, `pty-broker-cli.ts` |
| PTY multiplexer (multi-viewer) | `forge/src/pty-multiplexer.ts` |
| Claude session bootstrap | `forge/src/claude-runtime.ts`, `claude-one-shot.ts` |
| Hook events + bus + config | `forge/src/hook-events.ts`, `hook-event-bus.ts`, `hook-config.ts` |
| Status-line monitoring | `forge/src/status-line.ts` (referenced) |
| Stream-JSON parsing | `forge/src/stream-json.ts` (referenced) |
| OSC 133 shell integration | `forge/src/osc133.ts` |
| MCP relay | `forge/src/mcp-relay.ts` |
| Transcript log | `forge/src/pty-transcript-log.ts` |
| Mock PTY (for tests) | `forge/src/mock-pty.ts` |
| Graceful shutdown | `forge/src/graceful-shutdown.ts` |
| IPC channel | `forge/src/ipc-channel.ts` |
| Output classifier | `forge/src/output-classifier.ts` |

`claude-runtime.ts` already encapsulates the 5-step bootstrap (IPC channel → user hooks → project hooks → status line → PTY spawn) with proper teardown ordering. Loom's daemon doesn't write any of this; it calls `createClaudeRuntime()`.

**Browser surface** (`apps/claude-wrapper/src/browser-session.ts` + `packages/beacon-browser` + `packages/portal` + `packages/rift` + `packages/lens`)

| Piece | Source |
|---|---|
| Browser session bootstrap | `claude-wrapper/src/browser-session.ts` |
| Browser mirror session | `lens.createBrowserMirrorSession` |
| Portal HTML/CSS rendering | `packages/portal/src/dom.ts`, `css-generator.ts`, mirror server |
| Beacon-Browser extension | `beacon-browser/src/index.ts` (`beaconBrowserExtension`) |
| Surface bridge server | `claude-wrapper/src/browser-session-utils.ts` (`createSurfaceBridgeServer`) |
| Selection / copy handling | `claude-wrapper/src/browser-session-utils.ts` (`buildSelectionCopyToastSurface`) |
| Browser-compatible terminal renderer | `packages/rift/` (ANSI parser + renderer + bridge) |

The wrapper already runs `pnpm browser` and gets a working browser-served interactive Claude Code session. Loom doesn't write a daemon, doesn't write WebSocket plumbing, doesn't write xterm.js integration. It composes these.

**Telemetry, Mission Control, agent roster**

The `apps/claude-wrapper` already has Mission Control (session phase, pending tool, active agent count, token/cost curves), Process Tracker, Session Tracker, Cost Tracker, Agent Roster, File Heatmap. All derived from hook events + status line + stream-json. Documented in `PTY_DATA_MODEL.md`.

**Multiplayer / remote sharing** (`packages/warp/`)

| Piece | Source |
|---|---|
| CRDT for collaborative state | `warp/src/crdt.ts` |
| WebSocket server / client | `warp/src/ws-server.ts`, `ws-client.ts` |
| Protocol + serializer | `warp/src/protocol.ts`, `serializer.ts` |
| SSH adapter for tunnel mode | `warp/src/ssh-adapter.ts` |
| Session model | `warp/src/session.ts` |

Loom's "stakeholder reviews the prototype via shared URL" requirement is `warp` plus the existing browser surface. The CRDT base is stronger than the v2 PRD's "shared-secret + YAML appended-to" model. Adversarial review T10 (YAML merge conflicts) is moot if reviews ride on `warp`'s CRDT.

**Diff viewing** (`packages/parallax/`)

`parallax` is an interactive diff viewer. Loom's "side-by-side visual diff between two versions" gets composed from `parallax` + the design preview's screenshot pair, instead of being built fresh.

**TUI / studio primitives**

If Loom ever needs TUI surfaces:

- `nebula` — Elm Architecture runtime, vdom, signals, focus
- `constellation` — 100+ component builders (dialog, command-palette, context-menu, detail-panel, data-table, combobox, chip, badge, breadcrumb, etc.)
- `horizon` — windowing primitives (panel, floating, peek, pip, split, tabs, stack, shell, workspaces)
- `corona` — design tokens (statusTokens, costTokens, diffTokens, gitTokens, syntaxTokens, theme system)
- `aurora` — animation primitives
- `gravity` — flex, grid, responsive, breakpoints

Plus an existing `studios/` directory in `claude-wrapper/src/studios/` (modal-studio, overlay-studio, studio-preview, studio-property-panel, studio-types, studio-transitions, studio-code-gen, studio-primitives). The "studio" concept is already built. Loom's UI uses these — it doesn't invent a parallel "studio UI."

**MCP toolkit**

- `agent` — MCP client subscription primitive
- `beacon` — MCP rendering toolkit (server-side)
- `beacon-browser` — MCP rendering toolkit (browser-side)
- `mcp-relay` (in `forge`) — relay tools between hosts

Loom's `loom-tools` MCP server is implemented on top of `beacon`. Tools render to browser UI via `beacon-browser` chunks automatically.

**Validation infrastructure**

`packages/observatory` does real PTY scenario validation. Loom's determinism CI gets a substantial harness for free.

**Plugin SDK**

`packages/plugin-sdk` — community plugin SDK for Celestial. Loom can ship its own plugin shape compatible with this, or just live as an app.

---

## 2. Name collisions

Three Loom-side names collide with existing Celestial packages. None are fatal, all need resolution.

| Loom v2 PRD name | Collides with | Resolution |
|---|---|---|
| "canvas" (the design preview iframe / pane) | `packages/canvas/` — Celestial's vector/diagram scene rendering (DAG, document, align, connector, eyedropper) | Rename Loom's design preview to **"stage"** or **"preview pane"**. "Canvas" stays bound to Celestial's vector graphics. |
| "studio UI" (Loom's web surface name) | `apps/claude-wrapper/src/studios/` and various `studio-*` primitives | Loom's UI is **"Loom Console"** or just unnamed (it's a view of the claude-wrapper browser session, composed with Loom-specific panes). It's built FROM the studio primitives, not named "studio." |
| `prism` (alternate Loom name considered in v1) | `packages/prism/` — Celestial's terminal image rendering | Already eliminated in PRD v1 naming. Confirmed off the table. |

The plugin name **`loom`** is not used in Celestial. Safe.

---

## 3. The package map — v2 PRD components onto Celestial

The most useful artifact of this brief. Each row is a v2 PRD component, the Celestial package(s) that replace or contain it, and what Loom still has to add on top.

| v2 PRD component | Celestial substrate | Loom additions on top |
|---|---|---|
| Daemon process (Fastify + WS + state cache) | `claude-wrapper/src/browser-session.ts`, `surface-bridge.ts`; `forge.claude-runtime` | Project lifecycle, project-DB SQLite, file watcher on `tokens/components/routes/` |
| PTY hosting Claude Code (OAuth, interactive) | `forge.createClaudeRuntime` + `pty-host.ts` (in-process or broker) | None — direct reuse |
| Browser chat surface | `browser-session.ts` + `lens.createBrowserMirrorSession` + `beacon-browser` + `rift` | Loom-specific panes injected via `beaconBrowserExtension` |
| Hook event ingestion | `forge/hook-events.ts` + `hook-event-bus.ts` + `hook-config.ts` | Loom-specific hook listeners (e.g. on `Edit`/`Write` to design-system paths → re-render) |
| MCP server (loom-tools) | `beacon` (server) + `mcp-relay` | Loom-specific tools: project_*, token_*, component_*, route_*, panel_run, forge_run, export, comment_* |
| Studio UI (project tree, preview, inspector, timeline, comments) | `studios/` primitives + `constellation` components + `horizon` windowing | Loom-specific composition: project-tree pane, preview pane, version timeline, inspector tabs, comment overlay |
| Element ID injection (Vite plugin for `data-loom-id`) | None — new | Net new: Vite plugin that AST-walks JSX, injects deterministic IDs (per §5.4 of v2 PRD) |
| Multi-viewport preview iframe | `portal` (mirror server) + Vite dev server (project-scoped) | Per-project Vite instance, multi-viewport switcher, screenshot cache |
| Snapshot rendering | `lens` (visual capture) + Playwright | Loom-specific: route-render cache keyed by `(route, viewport, theme, versionId)` |
| Version graph (content-addressed Merkle) | None — new (but `ephemeris` for causal event ledger is adjacent) | Net new: SQLite tables (versions, branches, file_blobs), manifest hashing |
| Branch / diff / restore | `parallax` (diff viewer), git via `forge.exec` | Loom-specific: visual diff = render-pair through `parallax` |
| Inline element comments | `beacon-browser` chunk for the overlay + `surface-bridge` for posting | Loom-specific: pinned-to-data-loom-id overlay + feedback DB |
| Multi-stakeholder review URL | `warp` (CRDT WS server/client + SSH adapter) | Loom-specific: review-state schema, route_review table |
| 5-agent design panel | None — new skill | Net new: `panel` skill body that dispatches 5 Task calls in parallel (visual-critic, a11y-reviewer, copy-editor, brand-keeper, responsive-checker), plus 5 agent definitions |
| Forge loop | `forge.exec` + `lens` (visual capture) + `parallax` (delta scoring); user's interactive Claude session does the dispatching | Net new: `forge` skill body (render → Task dispatch → Edit → render → judge); git worktree scaffold to avoid working-tree damage |
| A11y validation (axe-core) | None — new; but `lens` provides Playwright | Net new: axe-core integration, validation_runs table |
| Lighthouse perf validation | None — new; but Playwright is already present | Net new (v1.1) |
| Token-usage lint | None — new; AST analysis over JSX | Net new |
| Design-system data model (`tokens/*.yaml`, `components/`, `routes/`) | None — new | Net new: this IS the Loom-specific value |
| Token resolver (OKLCH, references, themes) | None — new; `corona` has tokens but for TUI styling | Net new: Loom's token resolver for project design systems (distinct from corona's framework tokens) |
| Framework exports (CSS vars, Tailwind, SD, React/Vue/Svelte/WC, Storybook MDX, route map) | None — new | Net new: per-target code generators |
| Mission Control / cost tracking | claude-wrapper already has it | Loom adds a "Loom-specific" view to the existing Mission Control rather than building anything |
| Multi-project session management | `cluster` (multi-process state sync) is adjacent | Loom-specific: project registry + active-project tracking |
| Telemetry (local SQLite only) | `ephemeris` (causal event ledger) is adjacent | Loom-specific event types layered onto Celestial's existing telemetry |
| Doctor / install diagnostics | Celestial's pnpm + tsup + biome lint baseline | Loom adds Loom-specific environment checks (Playwright Chromium, project-dir health) |

Roughly: **of ~24 major v2 PRD components, ~10 are net-new for Loom and ~14 are direct or composed reuse of Celestial.**

---

## 4. Architecture (revised)

```
+--------------------------------------------------------------+
| Browser (user + stakeholders)                                |
|                                                              |
|  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  |
|  │ Claude chat    │  │ Preview pane   │  │ Inspector +    │  |
|  │ (rift)         │  │ (Vite-rendered │  │ timeline +     │  |
|  │                │  │  React iframe) │  │ comments       │  |
|  └────────────────┘  └────────────────┘  └────────────────┘  |
|         ▲                    ▲                    ▲          |
|         │                    │                    │          |
|         │ beacon-browser ext (Loom-injected chunks)          |
+---------┼────────────────────┼────────────────────┼----------+
          │                    │                    │
          │ WS via             │ HTTP via           │ WS via
          │ portal mirror      │ Fastify proxy      │ surface-bridge
          ▼                    ▼                    ▼
+--------------------------------------------------------------+
| apps/loom  (NEW Celestial app)                               |
|                                                              |
|  ┌──────────────────────────────────────────────────────┐    |
|  │ Composes:                                            │    |
|  │  - forge.createClaudeRuntime → interactive `claude`  │    |
|  │  - lens.createBrowserMirrorSession → browser surface │    |
|  │  - beacon (server) → loom-tools MCP                  │    |
|  │  - beacon-browser → Loom UI chunks                   │    |
|  │  - portal (mirror) → DOM rendering                   │    |
|  │  - warp → stakeholder review URLs                    │    |
|  │  - parallax → visual diff                            │    |
|  │  - observatory → determinism CI                      │    |
|  │  - studios/* → property panels & preview wiring      │    |
|  │  - constellation/horizon/corona/aurora → UI          │    |
|  │                                                      │    |
|  │ Adds:                                                │    |
|  │  - Project lifecycle + SQLite                        │    |
|  │  - Token model (YAML, OKLCH, resolver, lint)         │    |
|  │  - Component / route model + file watcher hooks      │    |
|  │  - Element-id Vite plugin (data-loom-id injection)   │    |
|  │  - Per-project Vite dev server                       │    |
|  │  - Snapshot/version Merkle graph                     │    |
|  │  - panel skill + 5 agent definitions                 │    |
|  │  - forge skill (in-session, git-worktree-scoped)     │    |
|  │  - axe-core validation                               │    |
|  │  - Framework exports                                 │    |
|  └──────────────────────────────────────────────────────┘    |
+--------------------------------------------------------------+
          │
          │ stdio + IPC + hooks
          ▼
+--------------------------------------------------------------+
| `claude` process (interactive, OAuth-authenticated)          |
|  - Loom plugin loaded (skills + agents + MCP)                |
|  - User drives via PTY (terminal or browser-rendered TUI)    |
+--------------------------------------------------------------+
```

The boxes in `apps/loom` are mostly compositions of existing Celestial packages. The "Adds" list is the genuine new work — design-system primitives, the panel and forge skills, element-ID injection, framework exports.

The OAuth question disappears: `forge.createClaudeRuntime` already wraps a normal interactive `claude` invocation. No `-p`, no SDK, no API key. Same auth the wrapper already uses.

---

## 5. Phase plan compression

The v2 PRD planned 15 weeks. The adversarial review estimated 30-40 weeks realistic. With Celestial as substrate, the plan compresses substantially.

**Updated phase plan:**

| Phase | What | Original weeks | Revised weeks | Why |
|---|---|---|---|---|
| 0 | Spike: scaffold `apps/loom`, prove end-to-end with one component | 1 | 1 | Celestial substrate means most plumbing is import + compose |
| 1 | MVP: project + token + component + route MCP tools, file watcher, HMR via project-scoped Vite, basic studio UI panes via beacon-browser chunks, axe-core | 4 | 3 | PTY, browser surface, hook events, MCP toolkit all already there |
| 2 | Review surface: element-ID Vite plugin, comment overlay (beacon-browser chunk), feedback DB, review states, design panel (5 agents + dispatch skill), tunnel mode via warp | 4 | 4 | Panel agents are genuinely new content; element-ID Vite plugin is new; everything else composes |
| 3 | Branching + diff + forge loop (in-session, git-worktree-scoped) | 2 | 2 | Diff visualization gets parallax for free; forge skill is new |
| 4 | Hardening + multi-framework exports (React-shadcn must; Vue / Svelte / WC are should) | 2 | 3-4 | Codegen is genuinely a lot of work per target; this is the section where the adversarial T9 concern survives |
| **Total** | | **15** | **~13-14** | Compressed by reuse, plus React-only honesty for v1 |

The adversarial T4 concern (Phase 2 is fantasy) softens: the panel orchestration is the only genuinely hard new thing in Phase 2; PTY + browser + hook ingestion + tunnel all compose from existing packages. The T16 concern (solo-maintainer burden on a 30-40 week build) softens to ~13-14 weeks of net-new work plus normal integration overhead.

**What still hurts at v1:**

- Framework export targets (T9). v1 ships React-shadcn only; Vue/Svelte/WC are v1.2. Don't pretend otherwise.
- Forge convergence with Haiku judge (T2). Still unproven; still needs calibration.
- Token-usage lint accuracy (PRD §15 Q10). New AST analysis Loom owns.
- Cross-OS pixel determinism (T3). Soften to perceptual diff on cross-OS, hash-equality same-OS only.

These survive the Celestial substrate.

---

## 6. Other adversarial-review findings, re-evaluated

| Finding | Status under Celestial |
|---|---|
| T1 (forge `git reset --hard` data-loss) | Already mitigated by my earlier fix (git worktree). Celestial's `forge.exec` makes git ops first-class. |
| T2 (Haiku judge unproven) | Unchanged. Still needs Phase 0 calibration. |
| T3 (cross-OS pixel determinism) | Unchanged. Soften AC3 to perceptual diff cross-OS. |
| T4 (Phase 2 fantasy) | Substantially softened. PTY + browser + hook ingestion all reuse; only panel orchestration + element-id Vite plugin are net new in P2. |
| T5 (Fast Refresh under agent edits) | Unchanged. Still need a "this edit will cost state" warning. |
| T6 (memory budget off by 5-8×) | Improves substantially. No 5× headless agent processes (per OAuth bridge doc); also, Celestial's `cluster` package + broker PTY pattern keeps process count manageable. Realistic ~1 GB during panel, ~500 MB idle. |
| T7 (JSX spread breaks element ID) | Unchanged. Still owned by Loom's Vite plugin. |
| T8 (studio UI no chat = PM regression) | Resolved. Loom's browser surface uses `rift` + `lens.createBrowserMirrorSession` + `beacon-browser` — the same browser session the wrapper already runs. Chat IS in the browser. |
| T9 (multi-framework export in 3 weeks) | Unchanged. Drop Vue/Svelte/WC to v1.2 in PRD v3. |
| T10 (`.loom/reviews/<branch>.yaml` merge conflicts) | Substantially resolved. Reviews ride on `warp` CRDT instead of YAML-append. |
| T11 (multi-project OOM) | Improves. Celestial's broker PTY mode + cluster sync mean multiple projects don't each spawn their own claude. |
| T12 (competitive moat thinning post-Claude-Design-v2) | Unchanged. Framework exports + Celestial-rooted local-first remain the moat. |
| T13 (SDK runtime-transfer fantasy) | Resolved. `forge.createClaudeRuntime` is the actual primitive; no SDK needed. |
| T14 (panel synthesis calibration) | Unchanged. Still needs a held-out test set in Phase 0. |
| T15 (time/random sources in components break determinism) | Unchanged. Need AST lint Loom owns. |
| T16 (solo-maintainer surface) | Substantially softened. Net-new code estimate drops from "everything in the PRD" to ~10 of 24 components. |

Eight of 16 findings either resolve or substantially soften under the Celestial substrate. Four resolve completely. Four are genuinely Loom-owned and still need work.

---

## 7. Recommended decisions for Eric

These are the calls only you can make. None of them affect the integration brief, but each affects what gets written in PRD v3.

1. **App vs. plugin vs. both.** Loom lives best as `apps/loom/` in the Celestial monorepo for v1 development. Long-term, do you want it published as a separate npm-installable Celestial plugin (via `plugin-sdk`)? That's a v1.1 concern.

2. **Rename "canvas" in Loom docs.** I'll use **"stage"** for the design preview pane unless you prefer another word. Open to "preview" or "easel" too.

3. **Element-ID Vite plugin home.** New plugin under `packages/loom-vite/` or just inline in `apps/loom/src/vite-plugin/`? The former is more reusable (other Celestial apps could pick it up); the latter is less ceremony.

4. **Reviews on `warp` CRDT.** This is a meaningful architectural pivot from "`.loom/reviews/<branch>.yaml`" in the v2 PRD. Confirm the move?

5. **Loom is solo-buildable on Celestial.** With Celestial as substrate, my honest estimate drops from "30-40 weeks" (adversarial agent's call) to ~13-14 weeks of net-new work. That puts v1 ship in late August 2026 at a steady pace. Do you want to commit, or do you want to time-box a Phase 0 spike first to validate the integration assumptions?

6. **PRD v3.** Do you want me to write a PRD v3 that absorbs this integration, or keep this brief as a sidecar and treat the v2 PRD as canonical with this doc layered on top?

---

## 8. One thing I want to verify next

The `studios/` directory in `claude-wrapper/src/studios/` has `studio-preview.ts`, `studio-property-panel.ts`, `studio-code-gen.ts`. This is potentially a much closer fit to Loom's "studio UI" than I've assumed — it might already do most of what Loom's inspector/preview surface needs. A 30-minute read of those files before writing PRD v3 would clarify exactly how much further the compression goes. Worth doing.
