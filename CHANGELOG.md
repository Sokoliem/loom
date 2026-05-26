# Changelog

## [Unreleased]

## [0.10.0-beta.1]

### Added
- feat(studio): project-management surface gated by `LOOM_FEATURE_PROJECT_MGMT=1` — left-rail project switcher, routes/tokens/components sidebar tabs, editable project header with git status, version-history strip per route, activity-event drawer with WS push. Backed by additive `activity_events` SQLite table and 12 new HTTP endpoints + 1 WS stream under `/api/loom/projects/...`. See `docs/ARCHITECTURE.md` for the layout.
- feat(core): `activityInsert/activityList/activityTrim` (+ in-memory `activityBus`) for the new project-management activity feed.
- feat(core): `gitStatus` helper with 2s timeout and 2s in-memory cache for the project header.
- feat(core): `versionRestoreWithAutoSnapshot` — atomic snapshot-before-restore for the "restore" button.
- feat(core): `projectUpdate` for renames and description edits.
- feat(core): local-only JSONL telemetry (opt-in via `LOOM_TELEMETRY=1`) emitting `project.switch`, `project.create`, `version.restore`.

### Fixed
- fix(plugin): published plugin.zip ships a slimmed `package.json` so `npm install` of `better-sqlite3` works on first MCP launch from the cache directory (previously the dev-time `link:` Celestial deps caused `EUNSUPPORTEDPROTOCOL`).

## [0.9.6]

- feat(studio): pre-start config modal with persisted claude flags
- fix(studio): PTY cols no longer overflows the visible pane

## [0.9.5]

- feat(pty): text + image paste in studio terminal

## [0.9.4]

- fix(studio): PTY size now tracks pane width (font-aware measurement)
- fix(studio): keys + mouse + wheel via Celestial primitives
