# Kanban Data Model Enhancement Plan

## Scope

Performance optimization for kanban - replace slow JSON file operations with SQLite database and file watcher for real-time session detection.

---

## Phases

| Phase | Name | Status | Bean ID |
|-------|------|--------|---------|
| 01 | SQLite Database | completed | ccc-viz-trox |
| 02 | File Watcher | completed | ccc-viz-hbtm |
| 03 | Archive Tables | completed | ccc-viz-clc6 |

Query phases: `beans query '{ beans(filter: { search: "Phase" }) { id title status } }'`

---

## Dependencies

```
Phase 01: SQLite Database
    │
    ├──> Phase 02: File Watcher
    │
    └──> Phase 03: Archive Tables
```

---

## Commands Reference

| Purpose | Command |
|---------|---------|
| Type check | pnpm typecheck |
| Run tests | pnpm test |
| Run E2E tests | pnpm e2e |
| Build | pnpm build |
| Dev server | pnpm dev |

---

## Related Docs

- [CLAUDE.md](../CLAUDE.md) - Project guidance
