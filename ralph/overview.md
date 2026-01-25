# AI-Generated Kanban Card Titles

## Scope

Enhance kanban cards with AI-generated titles using Claude CLI with haiku model. Titles generated from session content (user prompts + assistant responses).

---

## Phases

| Phase | Name | Status | Bean ID |
|-------|------|--------|---------|
| 01 | Core AI Title Generation | completed | ccc-viz-l7gt |
| 02 | Apply During Card Creation | completed | ccc-viz-w2eu |
| 03 | Single Card Regeneration | todo | ccc-viz-fzve |
| 04 | CLI Migration Script | todo | ccc-viz-tajp |

Query phases: `beans query '{ beans(filter: { search: "Phase" }) { id title status } }'`

---

## Dependencies

```
Phase 01 (Core AI Title Generation)
    ├── Phase 02 (Apply During Card Creation)
    ├── Phase 03 (Single Card Regeneration)
    └── Phase 04 (CLI Migration Script)
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

