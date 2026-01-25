# Kanban Board for Session Organization

## Scope

Add kanban board view to organize Claude Code sessions with 5 columns: archive, back-log, in-progress, discard, complete. Auto-create cards from sessions with ability to merge multiple sessions into one card.

---

## Phases

| Phase | Name | Status | Bean ID |
|-------|------|--------|---------|
| 01 | Foundation | todo | ccc-viz-o1b7 |
| 02 | API Routes | todo | ccc-viz-znao |
| 03 | UI Components | todo | ccc-viz-0qde |
| 04 | Main Route | todo | ccc-viz-3m6p |
| 05 | Merging | todo | ccc-viz-6bca |
| 06 | Navigation | todo | ccc-viz-9qf3 |

Query phases: `beans query '{ beans(filter: { search: "Phase" }) { id title status } }'`

---

## Dependencies

```
Phase 01 (Foundation)
    │
    ▼
Phase 02 (API Routes)
    │
    ▼
Phase 03 (UI Components)
    │
    ▼
Phase 04 (Main Route)
    │
    ▼
Phase 05 (Merging)
    │
    ▼
Phase 06 (Navigation)
```

---

## Commands Reference

| Purpose | Command |
|---------|---------|
| Dev server | `pnpm dev` |
| Type check | `pnpm typecheck` |
| Unit tests | `pnpm test` |
| E2E tests | `pnpm e2e` |
| Build | `pnpm build` |

---

## Related Docs

- [CLAUDE.md](../CLAUDE.md) - Project guidance
