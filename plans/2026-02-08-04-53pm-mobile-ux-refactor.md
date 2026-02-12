# Mobile UX Complete Refactor

## Problem

The session detail page (and other pages) are unusable on mobile:
1. **Global font size overrides in `app.css`** blow everything up - `text-xs` is 18px, `text-sm` is 22px, `text-base` is 26px. This is the ROOT CAUSE.
2. **Title/header takes the entire viewport** - project path + session UUID displayed in full at huge font size
3. **No text truncation** on long strings (project paths, session IDs)
4. **"Send Prompt to Claude" form** takes massive vertical space
5. **Filter buttons/controls** are oversized and waste space
6. **Message cards** have excessive spacing
7. **Back navigation links** take full lines unnecessarily
8. **Kanban board** - 300px fixed columns too wide for small phones

## Plan

### Phase 1: Fix Global Font Size Overrides (ROOT CAUSE)

**File: `app/app.css`**
- Remove the global `!important` font size overrides entirely (lines 9-19)
- These override ALL Tailwind text utilities, making everything ~1.5x larger than intended
- This single change fixes 70% of the mobile issues
- If larger text is desired on desktop, use responsive classes (`md:text-lg`) where needed

### Phase 2: Session Detail Header Refactor

**File: `app/routes/$project.sessions.$sessionId.tsx`**

Current header structure (lines 971-977):
```
<h1> 🟢 -Users-bryanarendt-code2-plannotator - Session Details </h1>
<p> Project: -Users-bryanarendt-code2-plannotator · Session: 5bb4adce-87d3-4584-aa9a-33615d53ac99 </p>
```

Refactor to:
- **Mobile**: Show only formatted project name (e.g., "plannotator") + truncated session ID (first 8 chars)
- **Desktop**: Show full details
- Reduce heading size on mobile: `text-base md:text-xl`
- Make status dot smaller inline
- Collapse project + session info into a compact metadata row

### Phase 3: Compact Mobile Controls

**File: `app/routes/$project.sessions.$sessionId.tsx`**

- **Navigation links**: Combine "Back to sessions" and "Back to projects" into icon-only breadcrumb on mobile
- **Sort/View toggles**: Make horizontal compact row with smaller touch targets
- **Messages/Files tabs**: Already ok but reduce padding
- **Category filter chips**: Reduce to icon-only on mobile (hide count text)
- **"Send Prompt" form**: Collapse into expandable section on mobile (hidden by default, tap to expand)
- **Since last message**: Merge into metrics bar instead of separate line

### Phase 4: Message Cards Density

**File: `app/routes/$project.sessions.$sessionId.tsx`**

- Reduce card padding: `p-1.5 sm:p-2 md:p-3`
- Tighten gap between cards
- Make tool result badges smaller on mobile
- Ensure code blocks don't overflow with proper `overflow-x-auto` and smaller text

### Phase 5: Sessions List Page

**File: `app/routes/$project.sessions._index.tsx`**

- Session cards: tighter padding on mobile
- Metadata line: more compact on mobile
- Status badges: already small, verify they work after font fix

### Phase 6: Kanban Board Mobile

**File: `app/routes/kanban.tsx` + `app/welcome/KanbanBoard.tsx` + `app/welcome/KanbanColumn.tsx`**

- Column width: `min-w-[280px] w-[280px] sm:min-w-[300px] sm:w-[300px]`
- Search input: change `w-64` to `w-full sm:w-64`
- Toolbar: stack vertically on mobile with `flex-col sm:flex-row`

### Phase 7: Projects List Page

**File: `app/routes/_index.tsx`**

- Table layout: should work fine after font fix, verify
- Search input: ensure full width on mobile

## Implementation Order

1. Phase 1 first (biggest impact, single file change)
2. Phase 2 (most visible page, biggest UX win)
3. Phase 3-4 together (same file, related changes)
4. Phase 5-7 (secondary pages, quick fixes)

## Expected Outcome

- Session detail page fully usable on 375px+ screens (iPhone SE and up)
- No horizontal overflow anywhere
- All interactive elements meet 44px touch target guidelines
- Information density appropriate for screen size
- Progressive disclosure: show more detail on larger screens
