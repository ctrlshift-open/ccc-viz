---
# ccc-viz-tajp
title: 'Phase 04: CLI Migration Script'
status: completed
type: task
priority: normal
created_at: 2026-01-25T20:24:37Z
updated_at: 2026-01-25T20:48:38Z
---

**Depends on:** Phase 01

## Tasks

- [x] Create scripts/migrate-titles.ts - read kanban.json, filter cards where version is undefined, loop and call Claude CLI
- [x] Set version = 1 after successful update
- [x] Save state after each card (resume-safe)
- [x] Print progress: "Updating card 1/50: Old Title → New Title"
- [x] Add migrate:titles script to package.json

## Verification

- [x] Run `pnpm migrate:titles` - all cards get updated titles
- [x] Check `~/.claude/cc-viz/kanban.json` for version field