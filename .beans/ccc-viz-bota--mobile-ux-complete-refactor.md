---
# ccc-viz-bota
title: Mobile UX complete refactor
status: completed
type: feature
priority: normal
created_at: 2026-02-08T21:56:00Z
updated_at: 2026-02-08T22:05:32Z
---

Refactor mobile UX across all pages. Root cause: global CSS font-size overrides making everything 1.5x too large.

## Checklist
- [x] Phase 1: Remove global font size overrides from app.css
- [x] Phase 2: Session detail header refactor (truncation, compact layout)
- [x] Phase 3: Session detail controls (collapsible prompt, compact nav)
- [x] Phase 4: Sessions list page verification
- [x] Phase 5: Kanban board mobile fixes
- [x] Phase 6: Projects list page verification
- [x] Phase 7: Visual verification at 375px width