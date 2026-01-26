# cc-viz: Story Detail Panel

## What This Is

A React Router 7 app for visualizing Claude Code sessions. Users browse projects, view session conversations, track costs, and organize work via a kanban board. This milestone adds a detail panel for stories to show full session information without truncation.

## Core Value

Make it easy to see all session information for a story without the card truncating content.

## Requirements

### Validated

- ✓ Browse Claude Code projects from ~/.claude/projects — existing
- ✓ View session conversations with message filtering — existing
- ✓ Track session costs with color-coded visualization — existing
- ✓ Kanban board to organize sessions by project+branch — existing
- ✓ Drag/drop stories between columns — existing
- ✓ Edit story titles inline — existing
- ✓ Link PRs to stories — existing
- ✓ Archive completed stories — existing

### Active

- [ ] Story detail panel slides in from right side
- [ ] Open panel via button/icon on card (not clicking whole card)
- [ ] Show full session names with clickable links to session view
- [ ] Show story metadata: created date, last activity, PR link, branch
- [ ] Quick actions in panel: move to column, archive, edit title
- [ ] Panel closes on click outside or X button
- [ ] Panel is scrollable for stories with many sessions

### Out of Scope

- Session content previews in panel — keep panel focused on navigation
- Multiple panels open at once — one panel at a time
- Panel stays open when switching cards — closes and reopens

## Context

- Existing kanban: `app/routes/kanban.tsx`, `app/components/KanbanBoard.tsx`, `app/components/StoryCard.tsx`
- Story type defined in `app/types/kanban.ts` with sessions array
- Cards currently truncate session names to fit compact layout
- Panel should complement cards, not replace them

## Constraints

- **Tech stack**: React Router 7, TailwindCSS v4, TypeScript — match existing patterns
- **SSR safety**: Dynamic imports for server modules in loaders/actions only
- **No new dependencies**: Use existing Tailwind for panel animations/styling

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Button trigger, not card click | Preserve drag-and-drop on card body | — Pending |
| Click outside to close | Standard flyout pattern users expect | — Pending |

---
*Last updated: 2026-01-25 after initialization*
