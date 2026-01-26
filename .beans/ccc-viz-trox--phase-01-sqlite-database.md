---
# ccc-viz-trox
title: 'Phase 01: SQLite Database'
status: completed
type: task
priority: normal
created_at: 2026-01-26T12:59:08Z
updated_at: 2026-01-26T13:23:07Z
---

**Depends on:** None

## Tasks

- [x] Add deps: better-sqlite3, drizzle-orm, drizzle-kit, @types/better-sqlite3
- [x] Create app/db/schema.ts - Drizzle schema (stories, sessions, stories_archive, sessions_archive)
- [x] Create app/db/index.server.ts - DB singleton with WAL mode at ~/.claude/cc-viz/kanban.db
- [x] Update vite.config.ts - Add ssr: { external: ["better-sqlite3"] }
- [x] Create app/db/queries.server.ts - Drizzle query helpers (getStories, updateStory, etc.)
- [x] Create scripts/migrate-json-to-sqlite.ts - One-time migration from JSON
- [x] Create drizzle.config.ts - Drizzle Kit config for migrations
- [x] Update app/utils/kanban.server.ts - Replace JSON read/write with Drizzle queries
- [x] Update app/types/kanban.ts - Add Drizzle inference if needed (no changes needed - types work as-is)

## Verification

- [x] Tests pass: pnpm test
- [x] No type errors: pnpm typecheck
- [x] Migration script preserves all data (6 stories, 31 sessions verified)