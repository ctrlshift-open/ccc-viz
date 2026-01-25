---
# ccc-viz-l7gt
title: 'Phase 01: Core AI Title Generation'
status: completed
type: task
priority: normal
created_at: 2026-01-25T20:24:32Z
updated_at: 2026-01-25T20:35:57Z
---

**Depends on:** None

## Tasks

- [x] Add `version` field to KanbanCard type in app/types/kanban.ts
- [x] Add function `extractSessionContent(project, sessionId)` - read session .jsonl, extract first/last user and assistant messages, write to temp file
- [x] Add function `generateAITitle(tempFilePath: string)` - execute claude CLI with haiku model, parse stdout, clean up temp file
- [x] Modify `generateTitle()` - try AI generation first, fallback to git branch / last message logic

## Verification

- [x] Tests pass: `pnpm test`
- [x] No type errors: `pnpm typecheck`