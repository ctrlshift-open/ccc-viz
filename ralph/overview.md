# Kanban Story Detail Slide-Over Panel

## Scope

Add a slide-over detail panel on the right side of the kanban board. Clicking a card selects it and opens the panel with full story details, vertical scrolling, and text wrapping. Cards remain compact.

---

## Phases

| Phase | Name | Status | Bean ID |
|-------|------|--------|---------|
| 01 | Create StoryDetailPanel Component | completed | ccc-viz-yob3 |
| 02 | Add Selection State to KanbanBoard | completed | ccc-viz-w651 |
| 03 | Update KanbanColumn Props | todo | ccc-viz-w931 |
| 04 | Update StoryCard Selection | todo | ccc-viz-8r2o |

Query phases: `beans query '{ beans(filter: { search: "Phase" }) { id title status } }'`

---

## Dependencies

```
Phase 01 (Create StoryDetailPanel Component)
    └── Phase 02 (Add Selection State to KanbanBoard)
        └── Phase 03 (Update KanbanColumn Props)
            └── Phase 04 (Update StoryCard Selection)
```

---

## Commands Reference

| Purpose | Command |
|---------|---------|
| Dev server | `pnpm dev` |
| Type check | `pnpm typecheck` |
| Run tests | `pnpm test` |
| Build | `pnpm build` |
| E2E tests | `pnpm e2e` |

---

## Related Docs

- [CLAUDE.md](../CLAUDE.md) - Project guidance
