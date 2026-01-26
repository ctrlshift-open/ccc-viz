---
# ccc-viz-clc6
title: 'Phase 03: Archive Tables'
status: completed
type: task
created_at: 2026-01-26T12:59:08Z
updated_at: 2026-01-26T12:59:08Z
---

**Depends on:** Phase 01: SQLite Database

## Tasks

- [x] Create archiveStory() transaction in queries.server.ts
- [x] Move story and sessions to archive tables atomically
- [x] Update kanban.tsx archive action to use new DB operation
- [x] Remove kanbanArchivePath() function
- [x] Remove kanban-archive.json file handling
- [x] Remove JSON split logic from saveKanbanState()
- [x] Delete kanban.json and kanban-archive.json after migration verified

## Verification

- [x] Tests pass: pnpm test
- [x] No type errors: pnpm typecheck
- [x] Archive moves rows to archive tables
- [x] Active tables no longer contain archived data
- [x] WAL mode handles concurrent access
