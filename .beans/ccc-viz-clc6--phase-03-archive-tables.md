---
# ccc-viz-clc6
title: 'Phase 03: Archive Tables'
status: in-progress
type: task
created_at: 2026-01-26T12:59:08Z
updated_at: 2026-01-26T12:59:08Z
---

**Depends on:** Phase 01: SQLite Database

## Tasks

- [x] Create archiveStory() transaction in queries.server.ts
- [x] Move story and sessions to archive tables atomically
- [ ] Update kanban.tsx archive action to use new DB operation
- [ ] Remove kanbanArchivePath() function
- [ ] Remove kanban-archive.json file handling
- [ ] Remove JSON split logic from saveKanbanState()
- [ ] Delete kanban.json and kanban-archive.json after migration verified

## Verification

- [ ] Tests pass: pnpm test
- [ ] No type errors: pnpm typecheck
- [ ] Archive moves rows to archive tables
- [ ] Active tables no longer contain archived data
- [ ] WAL mode handles concurrent access