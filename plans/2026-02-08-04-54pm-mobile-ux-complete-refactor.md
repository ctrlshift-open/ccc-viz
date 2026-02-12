# Mobile UX Complete Refactor

## Context

The app is unusable on mobile. The root cause is global CSS font-size overrides in `app.css` that make `text-xs` = 18px, `text-sm` = 22px, etc. Combined with no truncation on long strings and oversized UI elements, the session detail page can't even fit on screen. Screenshots show the title alone consuming 40%+ of viewport.

## Phase 1: Remove Global Font Size Overrides

**File: `app/app.css` (lines 8-19)**

Delete the entire `@layer utilities` block that overrides all Tailwind text sizes with `!important`. This single change fixes ~70% of mobile issues by restoring proper font sizes.

## Phase 2: Session Detail Header Refactor

**File: `app/routes/$project.sessions.$sessionId.tsx`**

### Header (lines 971-977)
- Reduce `text-xl` to `text-base md:text-xl` for h1
- Truncate project name display - use `formatProjectTitle()` (already exists, line 18) which extracts just the project name
- Truncate session ID to first 8 chars on mobile, with copy-to-clipboard on tap
- Merge project + session into single compact line: `plannotator · 5bb4adce`

### Metrics bars (lines 978-1003 mobile, 1004-1065 desktop)
- Merge "Since last message" (line 1066-1071) into the mobile metrics bar to eliminate extra row
- Keep dual mobile/desktop rendering strategy (already well done)

### Navigation + controls (lines 1089-1130)
- Combine back links into single line: `← sessions | projects`
- Move "Total lines" into metrics bar
- Keep sort/view toggles but reduce text sizes

### Send Prompt form
- Wrap in collapsible `<details>` element on mobile - hidden by default
- Keep open by default on desktop

### Category filter chips (lines 1163-1260)
- Already uses icons, just ensure proper wrapping after font fix

## Phase 3: Sessions List Page

**File: `app/routes/$project.sessions._index.tsx`**

- Verify layout works after font fix (likely just needs minor tweaks)
- Ensure session cards have proper mobile padding

## Phase 4: Kanban Board

**Files: `app/routes/kanban.tsx`, `app/welcome/KanbanBoard.tsx`, `app/welcome/KanbanColumn.tsx`**

- Search input: `w-64` → `w-full sm:w-64`
- Column width: `min-w-[280px] w-[280px]` on mobile (down from 300px)

## Phase 5: Projects List Page

**File: `app/routes/_index.tsx`**

- Verify after font fix, likely works fine

## Verification

1. `pnpm dev` and test at 375px width (iPhone SE) in Chrome DevTools
2. Check session detail page: header fits, controls accessible, messages readable
3. Check kanban: columns scroll horizontally, cards readable
4. Check sessions list: cards don't overflow
5. Check projects list: table readable
6. No horizontal scrollbar on any page
