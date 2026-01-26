---
# ccc-viz-hbtm
title: 'Phase 02: File Watcher'
status: completed
type: task
priority: normal
created_at: 2026-01-26T12:59:08Z
updated_at: 2026-01-26T13:46:04Z
---

**Depends on:** Phase 01: SQLite Database

## Tasks

- [x] Add chokidar dependency
- [x] Create app/utils/watcher-types.ts - Event type definitions (session:added, session:changed, etc.)
- [x] Create app/utils/session-watcher.server.ts - Singleton watcher on ~/.claude/projects/**/*.jsonl
- [x] Create app/routes/api.kanban.watch.ts - SSE endpoint
- [x] Create app/hooks/useSessionWatcher.ts - Client hook
- [x] Integrate with kanban.tsx - Subscribe via useSessionWatcher hook
- [x] Add syncOneSession() action for single-session updates

## Verification

- [x] Tests pass: pnpm test
- [x] No type errors: pnpm typecheck
- [ ] New sessions trigger incremental sync
- [ ] SSE connection receives events