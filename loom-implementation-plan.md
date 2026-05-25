# `loom` Implementation Plan

Converts `loom-prd-v3.md` into a phased engineering plan. Solo build by Eric on the Celestial substrate. Target v1.0 ship: **2026-09-04** (14 weeks from kickoff at 2026-05-30, assuming steady solo pace with normal 2-day-per-week slack).

This plan inherits the v3 PRD's must/should/won't and adversarial fixes, and pre-declares the cut list (the things that get dropped if a phase slips). It is structured for `git revert` per phase per the Celestial commit-discipline rule.

---

## 0. Plan-level invariants

These hold across every phase. They are non-negotiable.

- **One commit per phase or per task within a phase.** Never mega-commits. Each phase's exit gate corresponds to one revertable commit (or a small contiguous range).
- **All code lives in `apps/loom/`** with Loom-specific packages under `apps/loom/src/` and Loom-specific test fixtures under `apps/loom/test-projects/`. Loom does not modify Celestial's `packages/*` — if a primitive is missing, file a separate Celestial PRD.
- **Composition over rewriting.** Every Loom file begins by importing from Celestial packages where applicable. If a file duplicates Celestial logic, it gets refactored to compose.
- **Validation runs at phase exit, not on commit.** Each phase ends with a recorded validation run: commands run, exit codes, stdout/stderr excerpts captured in `apps/loom/docs/phase-N-validation.md`.
- **Cut list is pre-declared.** If a phase slips, the cuts come from the bottom of that phase's list — not from the next phase. The phase plan below shows each phase's cut order explicitly.
- **OAuth-only Claude auth from day 1.** No `claude -p`, no SDK. Verified by Phase 0 spike.

---

## 1. Dependency graph

The work splits into 7 parallelizable tracks. Within a phase, work in different tracks can proceed in parallel; across phases, tracks must respect phase-exit gates.

```
┌───────────────────────────────────────────────────────────────────┐
│ Track A — Substrate composition (PTY, browser, MCP server)        │
├───────────────────────────────────────────────────────────────────┤
│ Track B — Project lifecycle + SQLite + filesystem layout          │
├───────────────────────────────────────────────────────────────────┤
│ Track C — Token / component / route model + Vite plugin           │
├───────────────────────────────────────────────────────────────────┤
│ Track D — Stage pane (Vite-rendered preview iframe)               │
├───────────────────────────────────────────────────────────────────┤
│ Track E — Studio UI surfaces (file tree, timeline, inspector)     │
├───────────────────────────────────────────────────────────────────┤
│ Track F — Reviews (warp CRDT + comment overlay)                   │
├───────────────────────────────────────────────────────────────────┤
│ Track G — Panel + Forge skills + agents                           │
├───────────────────────────────────────────────────────────────────┤
│ Track H — Validation (axe, lints) + Exports                       │
└───────────────────────────────────────────────────────────────────┘
```

Track dependencies:
- B depends on A (needs daemon + MCP server)
- C depends on B (needs project lifecycle)
- D depends on C (needs routes to render)
- E depends on A + D (needs daemon + stage to display)
- F depends on E + warp package wired (Phase 2)
- G depends on C + D + Claude Task tool (Phase 2/3)
- H depends on C + D (Phase 1 axe + lints; Phase 4 export)

---

## 2. Phase 0 — Spike (Week 1)

**Objective:** Prove the substrate works end-to-end before committing to the build. If this fails, redesign before paying for Phase 1.

### Tasks

| ID | Track | Task | Estimated effort |
|---|---|---|---|
| 0.A1 | A | Scaffold `apps/loom/` with `package.json`, `tsconfig.json`, `tsup.config.ts`, basic `index.ts` entry, Celestial workspace deps wired | 2h |
| 0.A2 | A | Compose `forge.createClaudeRuntime` in a smoke entry — `apps/loom/src/smoke-pty.ts` — that spawns `claude` interactively in a PTY. Verify OAuth login flow completes when forced. | 4h |
| 0.A3 | A | Compose `lens.createBrowserMirrorSession` + `beacon-browser` extension + Fastify in a smoke entry — `apps/loom/src/smoke-browser.ts` — that serves the wrapper view in a browser tab. | 4h |
| 0.C1 | C | Write minimal Vite plugin `vite-plugin-loom-ids` that AST-walks JSX and injects `data-loom-id` attributes for simple cases (no spread, no map). Test fixture: one component. | 8h |
| 0.H1 | H | Hand-write a single React component referencing one token. Run through Vite, verify HMR works in the browser. | 2h |
| 0.G1 | G | **Forge judge calibration.** Author 5 canned routes with explicit subjective goals. Recruit 3 human scorers (Eric + 2 others). Run Haiku judge against each. Compute Pearson r. | 8h |
| 0.B1 | B | Determinism harness: write file → compute manifest hash → render snapshot → compare hashes across 3 runs same OS. | 4h |

### Exit gate

All of:
1. `apps/loom/src/smoke-pty.ts` runs `claude` interactively, OAuth login completes through the PTY without `-p`. **Acceptance:** screenshot of working session.
2. `apps/loom/src/smoke-browser.ts` renders the wrapper view in a browser tab. **Acceptance:** screenshot.
3. `vite-plugin-loom-ids` injects stable IDs for the simple-case fixture. **Acceptance:** snapshot of rendered DOM with `data-loom-id` attributes.
4. Determinism harness: 3 runs, same manifest hash, same snapshot hash. **Acceptance:** `apps/loom/docs/phase-0-validation.md` with shell logs.
5. Haiku judge calibration: r > 0.6 against human scorers on 5-route test set. **Acceptance:** calibration report with raw scores.

### No-go actions

- (1) fails → escalate to Celestial: `forge.createClaudeRuntime` isn't actually OAuth-clean. Possible fixes: investigate; verify against `claude-wrapper`'s own runtime; file Celestial issue.
- (2) fails → similar — escalate; the browser surface is the wrapper's, so any bug is shared.
- (3) fails → Vite plugin design wrong; rewrite spike before proceeding.
- (4) fails → determinism not achievable as designed; soften AC4 to "same-content snapshot ΔE < 0.5" and proceed.
- (5) fails (r < 0.6) → swap to Sonnet judge; recompute forge budget; if Sonnet pushes per-run cost above $1.50, drop forge feature or move to v1.1 with manual-step mode only.

### Cut list (if slipping)

- Cut 0.G1 to a later phase (forge spec only; ship phase 0 without calibration). **Risk:** Phase 3 might land with wrong-cost forge. Acceptable cost.
- Cut 0.B1 to Phase 1 (determinism harness becomes part of MVP gate instead). **Risk:** higher; if determinism is fundamentally broken, we find out later. Avoid this cut.

---

## 3. Phase 1 — MVP (Weeks 2-4)

**Objective:** Ship a real prototype build end-to-end through Claude. Single user, single project, single artifact, working HMR, basic validation, React-shadcn export.

### Tasks

| ID | Track | Task | Effort |
|---|---|---|---|
| 1.A1 | A | Full daemon bootstrap — `apps/loom/src/daemon.ts`: composes forge runtime + lens browser session + beacon-browser + Fastify + better-sqlite3 + chokidar | 12h |
| 1.A2 | A | `loom-tools` MCP server scaffold: server registration, tool registry, request validation via zod | 6h |
| 1.B1 | B | `server.sqlite` migrations: projects, server_state, telemetry_events | 3h |
| 1.B2 | B | `project_create / open / list / archive` MCP tools + filesystem scaffolding | 8h |
| 1.B3 | B | `project.sqlite` migrations: versions, branches, file_blobs, validation_runs, forge_runs, token_cache | 4h |
| 1.B4 | B | File watcher (chokidar wrapper): debounced 100ms, recompute manifest hash, broadcast `route_changed` | 6h |
| 1.C1 | C | Token model: YAML parser, OKLCH resolver, cycle detection, theme support | 12h |
| 1.C2 | C | Token MCP tools: `token_get / set / list / resolve_all` + token_cache writes | 6h |
| 1.C3 | C | Component model: filesystem layout + spec/tokens/a11y/stories files | 8h |
| 1.C4 | C | Component MCP tools: `component_create / get / list / update / delete / snapshot` | 8h |
| 1.C5 | C | Route model: file-system routing + `_layout.tsx` + auto-nav | 8h |
| 1.C6 | C | Route MCP tools: `route_create / get / list / update / delete / screenshot` | 8h |
| 1.D1 | D | Per-project Vite dev server: spawn, port-probe, multi-viewport iframe wrapper | 12h |
| 1.D2 | D | Stage pane beacon-browser chunk: subscribes to `route_changed`, swaps iframe src | 8h |
| 1.D3 | D | Multi-viewport switcher in stage pane chrome (desktop/tablet/mobile/custom) | 6h |
| 1.E1 | E | Studio UI shell: file tree + stage pane + minimal inspector (Tokens + Versions tabs) as beacon-browser chunks | 16h |
| 1.E2 | E | Version timeline rendering (parallax-composed visual diff placeholder for Phase 3) | 8h |
| 1.H1 | H | axe-core integration: per-route a11y scan in Playwright | 6h |
| 1.H2 | H | Token-usage lint: AST walk, flag raw colors outside token graph | 12h |
| 1.H3 | H | Deterministic-source lint: AST walk, flag Date.now/Math.random/crypto.randomUUID in component files | 8h |
| 1.H4 | H | Export targets v1: CSS vars + Tailwind config + Style Dictionary JSON + route-map markdown | 16h |
| 1.H5 | H | Export target v1 (the hard one): React-shadcn + Storybook MDX | 24h |
| 1.A3 | A | `validate(scope, kinds)` MCP tool dispatch + validation_runs writes | 6h |
| 1.A4 | A | `loom:start / stop / new / open / token / component / route / snapshot / doctor` slash commands as thin wrappers around MCP tools | 8h |

**Total Phase 1 effort:** ~225 hours ≈ 5.5 person-weeks. Compressed to 3 weeks if some tasks parallelize and stop-loss applies.

### Exit gate

Build a real prototype end-to-end through Claude:
1. Run `claude /loom:start`. Server up, browser tab opens.
2. Run `claude /loom:new dogfood-site`. Project scaffolds.
3. In chat, ask Claude to build a landing page: hero + 3-up features + CTA. Verify it writes to `components/` + `routes/` and the stage updates live.
4. Edit a token via `claude /loom:token set color.accent.primary oklch(0.65 0.20 250)`. Stage HMRs.
5. Run `claude /loom:snapshot v1`. Version row appears in inspector.
6. Run `claude /loom:validate axe`. Findings appear.
7. Run `claude /loom:export react-shadcn --out ./exports/`. Build succeeds with `npm install && npm run build`.

**Quantitative gate:** ≤1 manual workaround per session across 3 dogfood sessions.

### No-go actions

- React-shadcn export fails to round-trip → drop Storybook MDX requirement; ship "React + Tailwind + tokens" only; defer shadcn-compatible export to Phase 4.
- Token lint produces high false-positive rate → ship escape hatch (`// loom-ignore-next-line`) + warn-don't-fail mode.
- HMR latency p95 > 1.5s on a real project → profile; consider sharing Vite instances across components (more complex; risky).

### Cut list

Drop in order until phase fits:
1. 1.H5 (React-shadcn export) → push to Phase 4 hardening. Replace with simpler "CSS vars + Tailwind config + route-map only" v1 export. Risk: weakens v1 value prop.
2. 1.H3 (deterministic-source lint) → push to v1.1. Risk: snapshot determinism CI may catch issues anyway.
3. 1.E2 (version timeline placeholder) → push to Phase 3. Risk: low; placeholder isn't user-facing.

---

## 4. Phase 2 — Review + Panel (Weeks 5-8)

**Objective:** Make Loom multi-stakeholder. Element-pinned comments, warp-CRDT-backed review URL, 5-agent design panel returning useful findings.

### Tasks

| ID | Track | Task | Effort |
|---|---|---|---|
| 2.C1 | C | Vite plugin: handle JSX spread (hash source location) and `.map()` children (use key prop) | 12h |
| 2.C2 | C | Vite plugin: produce element-ID stability test suite (one fixture per case) | 6h |
| 2.F1 | F | warp integration: y-doc setup for reviews CRDT; protocol wiring with daemon | 16h |
| 2.F2 | F | Comment overlay beacon-browser chunk: read `data-loom-id` on click, render compose form, post to CRDT | 12h |
| 2.F3 | F | Inspector Reviews tab: subscribe to CRDT events, render thread list, severity, agent attribution | 12h |
| 2.F4 | F | Stale-comment flagging: detect element-ID mismatch on render, flag in UI | 6h |
| 2.F5 | F | Per-route review state (draft/in-review/approved) | 6h |
| 2.F6 | F | warp tunnel mode opt-in: SSH-adapter wrapper + secret generation + URL printing | 12h |
| 2.G1 | G | Five panel agents: visual-critic, a11y-reviewer, copy-editor, brand-keeper, responsive-checker | 24h |
| 2.G2 | G | `panel` skill: parallel Task dispatch, synthesis, severity merge | 12h |
| 2.G3 | G | Panel "Fix" action: applies suggested change as a commit | 8h |
| 2.G4 | G | Panel "Defer" action: persist deferred findings in CRDT | 4h |
| 2.G5 | G | Panel-finding-applied vs deferred metric: telemetry event + studio UI display | 4h |
| 2.E1 | E | Inspector pane: full layout with Tokens / Components / Versions / Reviews tabs | 12h |

**Total Phase 2 effort:** ~146 hours ≈ 3.6 person-weeks. Stays at 4 weeks given parallel tracks F and G.

### Exit gate

1. External reviewer (someone other than Eric) opens the warp-tunnel review URL and posts ≥5 comments on 5 different elements without help.
2. Concurrent-edit fuzz: 30 minutes of simulated comment-spamming from 2 browser tabs; no lost comments, no merge conflicts.
3. Run `/loom:panel` on a real artifact. Verify ≥3 findings produced, ≥70% of findings get "Fix" (applied) on the calibrated test set, ≤30% deferred.
4. Panel run cost: ≤$0.10 p50 in dogfood (actual billing record from API logs).
5. Stale-comment flagging: edit a component such that an element ID changes; comment is flagged "stale" in inspector — not silently dropped.

### No-go actions

- Panel applied-rate <70% → either tighten agent prompts (more iteration in 2.G1) or drop 1-2 agents (drop responsive-checker first; it's the most expensive). Re-gate.
- warp CRDT can't keep up with rapid comment volume → fall back to one-file-per-comment on disk per the v2 PRD model. Lose multi-stakeholder real-time but ship.
- Element ID Vite plugin produces unstable IDs in real JSX (spread + dynamic children at scale) → ship "best-effort + flag stale" mode; comments work but more flagging needed.

### Cut list

Drop in order:
1. 2.F6 (warp tunnel mode) → v1.1. Reviews only work on LAN/localhost.
2. 2.F5 (per-route review state) → v1.1.
3. One panel agent (drop responsive-checker first; reuses Playwright but expensive).
4. 2.G3 (panel "Fix" action) → manual application from inspector only; still ship findings.

---

## 5. Phase 3 — Branch + Forge (Weeks 9-10)

**Objective:** Two design directions in parallel; closed-loop forge that doesn't lose data.

### Tasks

| ID | Track | Task | Effort |
|---|---|---|---|
| 3.B1 | B | `version_snapshot / list / diff / restore` MCP tools | 8h |
| 3.B2 | B | `branch_create / switch / merge / list` MCP tools with `forge.exec` git wrapping | 12h |
| 3.B3 | B | 3-way merge: per-file content; Claude resolves text conflicts via in-session skill | 12h |
| 3.E1 | E | Visual diff via `parallax`: side-by-side route renders, click for ΔE overlay | 16h |
| 3.E2 | E | Branch switcher in studio chrome (top bar) | 4h |
| 3.G1 | G | `forge` skill: precondition check (clean working tree), `git worktree add` scaffold | 6h |
| 3.G2 | G | Forge iteration loop: Playwright render → Task dispatch (visual-critic-with-goal) → Edit → re-render → Task dispatch (Haiku judge) → score | 16h |
| 3.G3 | G | Forge convergence: stop on conf≥90 or iter==max or cost-cap | 4h |
| 3.G4 | G | Forge squash flow: `git merge --squash` worktree into branch on user approval | 6h |
| 3.G5 | G | Forge abort: cleanup worktree, write forge_runs row with outcome=aborted | 4h |
| 3.A1 | A | `branch_list / merge / restore` slash command surfacing | 6h |

**Total Phase 3 effort:** ~94 hours ≈ 2.3 person-weeks. Stays within 2 weeks.

### Exit gate

1. Solo user runs `/loom:branch create radical-redesign`. Switches via inspector. Edits land on the new branch.
2. Switch back to main. Cherry-pick one file from radical-redesign branch via Claude chat. Confirm clean merge.
3. Run `/loom:forge --goal "tighter visual hierarchy"`. Confirm:
   - Precondition: clean working tree required (otherwise refuses).
   - Forge runs in `.loom/forge/<runId>/` worktree (verify user's working tree unchanged via `git status`).
   - Convergence on calibrated goal in ≥3 of 5 trials.
   - Squash produces single commit on user approval.
4. Visual diff in inspector: side-by-side renders for two versions, perceptual diff overlay.

### No-go actions

- Forge convergence rate <3/5 on calibrated trials → reduce to manual-step mode (`/loom:forge step` per iteration); user reviews each step; auto-loop deferred to v1.1.
- 3-way merge for text conflicts unstable → ship "manual conflict resolution prompt only"; defer auto-resolver to v1.1.

### Cut list

1. 3.G4 (forge squash) → ship "no squash" only; forge produces N commits, user squashes manually. Risk: messy history.
2. 3.E1 (parallax visual diff) → ship "before/after thumbnail pair" only; defer parallax integration to v1.1. Risk: weaker UX.

---

## 6. Phase 4 — Hardening (Weeks 11-13)

**Objective:** Cross-platform install, determinism CI, real export round-trip verified into a production codebase.

### Tasks

| ID | Track | Task | Effort |
|---|---|---|---|
| 4.A1 | A | Cross-platform install scripts: macOS / Linux / Windows. Doctor checks: Node version, pnpm, Playwright Chromium, git, OAuth status | 16h |
| 4.A2 | A | Doctor command: full environment diagnosis with green/yellow/red per check | 12h |
| 4.H1 | H | Determinism CI: same-OS hash equality across 3 runs (per route) | 12h |
| 4.H2 | H | Determinism CI: cross-OS perceptual diff (ΔE < 2.0) on macOS + Linux runners | 16h |
| 4.H3 | H | Export round-trip CI: build the React-shadcn export in a clean sandbox, render via Playwright, compare to studio preview | 12h |
| 4.H4 | H | Export drop-in test: `cp -r exports/* into a fresh Next.js app; npm install && npm run dev`; verify rendering | 8h |
| 4.A3 | A | Telemetry hardening: ensure all events in §10.2 land in ephemeris + local SQLite | 6h |
| 4.A4 | A | Failure-mode recovery: F1-F21 from PRD §9.6 — verify each has working detection + mitigation | 24h |
| 4.G1 | G | Hook-order-change warning [fix T5]: AST analysis pre-write, surface warning, auto-snapshot option | 12h |
| 4.A5 | A | Documentation: `apps/loom/README.md`, plugin manifest, install guide, troubleshooting | 16h |
| 4.A6 | A | Marketplace listing prep (for v1.1 standalone plugin distribution via plugin-sdk): scaffolding only in v1 | 8h |

**Total Phase 4 effort:** ~142 hours ≈ 3.5 person-weeks. Fits in 3 weeks if tracks A and H parallelize.

### Exit gate

1. Fresh install on macOS 13+, Ubuntu 22+, Windows 11 each. Run through Phase 1 exit gate end-to-end. No manual intervention.
2. Determinism CI green: same-OS hash equality on all 3 platforms; cross-OS perceptual diff (ΔE < 2.0).
3. Export drop-in: take the v1 React-shadcn export, drop into a fresh Next.js app, build, render — visually equivalent to studio preview.
4. Doctor command: yields zero red checks on a healthy install; documents each yellow.
5. All 21 failure modes from PRD §9.6 verified: triggered intentionally, recovery confirmed.
6. Hook-order warning: write a test JSX file that converts useState→useReducer; verify warning fires pre-write.

### No-go actions

- Cross-OS perceptual diff fails to converge on Windows → ship with Windows determinism marked "best-effort"; document as known limitation; defer to v1.1.
- Export drop-in fails → fix until passes; this is core value prop.

### Cut list

1. 4.A6 (plugin-sdk marketplace prep) → v1.1.
2. 4.A2 (full doctor) → ship "minimal doctor" with Node/Playwright checks only.
3. Cross-OS CI → ship "single-OS" (macOS only); cross-OS as best-effort v1.1.

---

## 7. Phase 5 (v1.1) — Should-haves (post-launch)

**Objective:** Land the v1 "should" items and the cuts that landed during v1 phases.

| Item | Source | Effort |
|---|---|---|
| Vue + Svelte + WC export targets | v1 G12 (deferred) | 60h |
| Lighthouse perf validation | v1 should | 16h |
| Live data binding (`databinding_create` via other MCPs) | v1.1 goal | 24h |
| Dark-mode token system with `light-dark()` | v1 should | 12h |
| Static-bundle export | v1 should | 8h |
| Mock-data generator (seedable) | v1 should | 12h |
| Plugin-SDK distribution variant | v1.1 goal | 24h |
| Semantic element-ID rewrite tool | Open Q | 24h |
| Figma read-only token import | v1.2 (early?) | 24h |

**Total v1.1 effort:** ~204 hours ≈ 5 person-weeks. Run after v1 ship in parallel with v1 maintenance.

---

## 8. Validation gates (commands per phase)

Each phase records its validation in `apps/loom/docs/phase-N-validation.md` with exact commands, exit codes, stdout/stderr excerpts.

### Phase 0

```bash
# Spike: PTY runs claude interactively
node apps/loom/dist/smoke-pty.js
# Expected: claude TUI renders; OAuth login completes; exit 0 on /quit

# Spike: browser surface
node apps/loom/dist/smoke-browser.js &
sleep 2
curl -s http://localhost:5174/loom/smoke | grep -q "<title>Loom"
# Expected: 0

# Vite plugin: data-loom-id injection
cd apps/loom/test-fixtures/single-component && pnpm dev &
sleep 5
curl -s http://localhost:5173/ | grep -E 'data-loom-id="[a-f0-9]{12}"'
# Expected: ≥1 match

# Determinism: 3 runs same manifest hash
for i in 1 2 3; do
  node apps/loom/dist/determinism-harness.js fixture/landing-page
done | sort -u | wc -l
# Expected: 1

# Forge judge calibration
node apps/loom/dist/calibration-runner.js test-set/forge-goals-v1.yaml
# Expected: stdout includes "Pearson r: 0.6+"
```

### Phase 1

```bash
# Full MVP gate via Claude session
claude << 'EOF'
/loom:start
/loom:new mvp-test
build a landing page with hero, 3-up features, and CTA
/loom:snapshot v1
/loom:validate axe
/loom:export react-shadcn --out ./exports/mvp-test
EOF

# Verify export builds standalone
cd ./exports/mvp-test && pnpm install && pnpm build
# Expected: exit 0
```

### Phase 2

```bash
# Generate review URL
claude /loom:review url --tunnel
# stdout: https://...trycloudflare.com/loom/...

# External reviewer post (simulated via curl)
SECRET=$(cat .loom/secret)
curl -X POST -H "X-Loom-Secret: $SECRET" \
     -d '{"routePath":"/","elementSelector":"abc123de","body":"test"}' \
     https://...trycloudflare.com/api/loom/feedback
# Expected: 200; comment appears in studio UI WS event

# Panel run on calibrated artifact
claude /loom:panel test-projects/calibrated-flat-hierarchy
# Expected: ≥3 findings; ≥70% apply rate when each "Fix" is invoked

# Fuzz: 30 minutes concurrent comment spam from 2 simulated clients
node apps/loom/test-tools/fuzz-reviews.js --duration 30m --clients 2
# Expected: 0 lost comments, 0 CRDT divergence errors
```

### Phase 3

```bash
# Branch create + cherry-pick
claude << 'EOF'
/loom:branch create alt-direction
edit /Hero to use a darker palette
/loom:snapshot v2
/loom:branch switch main
cherry-pick the Hero change from alt-direction
EOF
git log --all --oneline -10  # verify clean history

# Forge precondition test
echo "dirty" >> components/Button/Button.tsx  # introduce dirty tree
claude /loom:forge --goal "tighter rhythm"
# Expected: refuses with "working tree must be clean"
git checkout components/Button/Button.tsx

# Forge convergence test
claude /loom:forge --route /test-flat-hierarchy --goal "three distinct moments" --max-iters 6
# Expected: outcome=converged in ≥3 of 5 runs across calibrated test set
```

### Phase 4

```bash
# Cross-OS determinism (run on each OS)
node apps/loom/dist/determinism-ci.js --target same-os
# Expected: hash equality across 3 runs

node apps/loom/dist/determinism-ci.js --target cross-os --reference snapshots-macos/
# Expected: ΔE < 2.0 for every route × viewport × theme

# Failure mode F1-F21 sweep
node apps/loom/test-tools/failure-mode-sweep.js
# Expected: 21/21 detected + recovered

# Doctor on clean install
loom doctor
# Expected: zero red checks
```

---

## 9. Parallelizable work breakdown

The 14-week plan assumes single-developer pacing. If Eric brings on a contributor in Phase 2+, the obvious split:

| Track | Owner if 1-dev | If 2-dev |
|---|---|---|
| A (substrate) | Eric | Eric (foundational) |
| B (project/SQLite) | Eric | Eric |
| C (model + Vite plugin) | Eric | Eric (model) + contributor (Vite plugin) — independent enough |
| D (stage pane) | Eric | Eric |
| E (studio UI) | Eric | Contributor (UI work is independent once D ships) |
| F (reviews/CRDT) | Eric | Contributor |
| G (panel/forge) | Eric | Eric (skill-writing is opinionated) |
| H (validation/export) | Eric | Contributor (export targets independent) |

2-dev acceleration estimate: 14 weeks → 10 weeks for v1.

---

## 10. Pre-declared cut list (in slip order)

If at any phase exit the gate fails AND adding 2 weeks isn't viable, cut in this exact order:

1. **Vue / Svelte / WC export targets** — already deferred to v1.2 in PRD v3; reaffirm.
2. **Tunnel mode (warp SSH adapter)** — push to v1.1. Reviews work LAN-only.
3. **Forge auto-loop** — ship `/loom:forge step` manual mode only.
4. **One panel agent (responsive-checker first)** — biggest cost saver.
5. **Cross-OS determinism CI** — ship macOS-only with documented limitation.
6. **Visual diff via parallax** — ship before/after thumbnails only.
7. **Live data binding via other MCPs** — already v1.1, reaffirm.
8. **Lighthouse perf** — already v1.1, reaffirm.
9. **Storybook MDX in React-shadcn export** — ship "React + Tailwind + tokens" only.
10. **Forge feature entirely** — only if Phase 0 Haiku calibration fails AND Sonnet pushes cost above acceptable.

If we reach cut 5+ during v1.0 phases, this is a signal that v1.0 should ship as v0.9-beta and v1.0 commits to those features in a follow-on cycle.

---

## 11. Calendar (weeks from 2026-05-30 kickoff)

| Week | Phase | Milestone |
|---|---|---|
| 1 | Phase 0 | Spike complete; substrate validated; calibration r > 0.6 confirmed |
| 2-4 | Phase 1 | MVP shipped; dogfood prototype built; React-shadcn export round-trips |
| 5-8 | Phase 2 | Review + panel; external reviewer feedback in; panel applied-rate ≥70% |
| 9-10 | Phase 3 | Branch + forge; closed-loop convergence on calibrated goals |
| 11-13 | Phase 4 | Hardening; cross-OS install; export drop-in into Next.js production app verified |
| 14 | v1 ship | Marketplace listing, public README, announcement |

**v1.0 ship target: 2026-09-04 (Friday, Week 14).**

If kickoff slips to 2026-06-06, v1.0 lands 2026-09-11. If Phase 0 reveals fundamental issues (gate (1) or (2) fails), the timeline is open until those resolve.

---

## 12. Risk-adjusted view

Phases 0 and 1 are the highest information-value moves. If either flunks its exit gate:

- Phase 0 fail (substrate doesn't work) → Loom isn't shippable as designed. Pivot: implement `claude -p` mode with explicit API-key requirement for users who have one; cede the OAuth-only goal as v1.1. Continue otherwise.
- Phase 1 fail (MVP can't dogfood without manual workarounds) → reduce scope of "must" requirements; ship narrower v0.9 that proves the loop but limits to fewer routes / no panel / no forge.

Phase 2 is the highest-uncertainty phase: it's the first place panel-noise calibration can fail at scale, and where warp-CRDT might prove insufficient. Both have explicit fallbacks (drop panel agents; revert to YAML reviews). Neither sinks the project.

Phase 3 is mostly mechanical (the forge skill is the only research moment, and Phase 0 has already calibrated it). Low risk.

Phase 4 risks are unexciting but real: Windows is reliably the long pole. Plan for 1 extra week of Windows-specific debugging.

---

## 13. What to commit to next

Eric's call. The most useful three:

1. **Confirm kickoff date.** 2026-05-30 default; if you're juggling other Celestial work, push out.
2. **Decide whether to time-box Phase 0 separately** before committing the rest of the calendar. A 1-week spike is small enough to drop without losing much; the calibration result alone is worth running.
3. **Single-dev vs. recruit a contributor.** 14 vs. 10 weeks. Affects whether v1 lands September or August.
