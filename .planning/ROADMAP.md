# Roadmap: Story Detail Panel

## Overview

Add a slide-in detail panel for kanban story cards. Panel shows full session information without truncation, provides clickable session links, displays metadata, and offers quick actions. Three phases: shell with trigger, content display, then actions.

## Phases

- [ ] **Phase 1: Panel Shell & Card Trigger** - Slide-in panel with open/close mechanics
- [ ] **Phase 2: Content Display** - Session list and metadata rendering
- [ ] **Phase 3: Quick Actions** - Edit, move, archive from panel

## Phase Details

### Phase 1: Panel Shell & Card Trigger
**Goal**: User can open/close a detail panel from any story card
**Depends on**: Nothing (first phase)
**Requirements**: PANEL-01, PANEL-02, PANEL-03, PANEL-04, CARD-01, CARD-02
**Success Criteria** (what must be TRUE):
  1. Clicking expand button on story card opens panel from right side
  2. Panel closes via X button or clicking overlay
  3. Panel is scrollable when content exceeds viewport height
**Plans**: 1 plan

Plans:
- [ ] 01-01-PLAN.md — Create panel shell with slide animation and wire to card/board

### Phase 2: Content Display
**Goal**: User can see all story information and navigate to sessions
**Depends on**: Phase 1
**Requirements**: CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04, CONTENT-05
**Success Criteria** (what must be TRUE):
  1. Full session names visible (not truncated) with clickable links
  2. Story metadata displayed: project, branch, dates, PR link
**Plans**: TBD

Plans:
- [ ] 02-01: Render session list and story metadata in panel

### Phase 3: Quick Actions
**Goal**: User can manage stories directly from the detail panel
**Depends on**: Phase 2
**Requirements**: ACTION-01, ACTION-02, ACTION-03
**Success Criteria** (what must be TRUE):
  1. User can edit story title from panel
  2. User can move story to different column from panel
  3. User can archive story from panel
**Plans**: TBD

Plans:
- [ ] 03-01: Add edit/move/archive controls to panel

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Panel Shell & Card Trigger | 0/1 | Not started | - |
| 2. Content Display | 0/1 | Not started | - |
| 3. Quick Actions | 0/1 | Not started | - |
