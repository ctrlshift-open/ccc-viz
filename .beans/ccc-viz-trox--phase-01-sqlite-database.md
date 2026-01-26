---
# ccc-viz-trox
title: 'Phase 01: SQLite Database'
status: in-progress
type: task
priority: normal
created_at: 2026-01-26T12:59:08Z
updated_at: 2026-01-26T13:12:39Z
---

**Depends on:** None

## Tasks

- [x] Add deps: better-sqlite3, drizzle-orm, drizzle-kit, @types/better-sqlite3
- [x] Create app/db/schema.ts - Drizzle schema (stories, sessions, stories_archive, sessions_archive)
- [x] Create app/db/index.server.ts - DB singleton with WAL mode at ~/.claude/cc-viz/kanban.db
- [x] Update vite.config.ts - Add ssr: { external: ["better-sqlite3"] }
- [x] Create app/db/queries.server.ts - Drizzle query helpers (getStories, updateStory, etc.)
- [ ] Create scripts/migrate-json-to-sqlite.ts - One-time migration from JSON
- [ ] Create drizzle.config.ts - Drizzle Kit config for migrations
- [ ] Update app/utils/kanban.server.ts - Replace JSON read/write with Drizzle queries
- [ ] Update app/types/kanban.ts - Add Drizzle inference if needed

## Verification

- [ ] Tests pass: pnpm test
- [ ] No type errors: pnpm typecheck
- [ ] Migration script preserves all data