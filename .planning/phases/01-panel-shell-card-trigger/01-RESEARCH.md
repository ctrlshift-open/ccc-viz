# Phase 1: Panel Shell & Card Trigger - Research

**Researched:** 2026-01-25
**Domain:** React slide-in panel with TailwindCSS, accessibility
**Confidence:** HIGH

## Summary

This phase implements a slide-in detail panel triggered from story cards on the kanban board. The codebase already has a working modal pattern (`FileViewer.tsx`) with escape key handling, body scroll lock, and click-outside-to-close. The standard approach is to build a custom panel component using native React 19 + TailwindCSS v4 (no new dependencies).

The existing `StoryCard.tsx` has drag-and-drop via native HTML5 draggable API. The expand button must NOT interfere with drag, which is achieved by `e.stopPropagation()` on the button's click handler (already a pattern used throughout the card for title editing, PR links, etc.).

**Primary recommendation:** Build custom `StoryDetailPanel` component following `FileViewer.tsx` patterns - use fixed positioning, escape key listener, overlay click-to-close, body scroll lock. Use TailwindCSS `translate-x` with `transition-transform` for slide animation.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | ^19.1.0 | Already in project | Native hooks for state/effects |
| TailwindCSS v4 | ^4.1.4 | Already in project | Animation utilities built-in |
| lucide-react | ^0.542.0 | Already in project | Consistent iconography |

### Supporting

No additional dependencies needed. The codebase already has all required tools:
- React 19 `useState`, `useEffect`, `useRef`, `useCallback`
- TailwindCSS v4 `transition-*`, `translate-x-*`, `fixed`, `overflow-y-auto`
- lucide-react for icons (`X`, `Expand`, `ChevronRight`)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom panel | @headlessui/react Dialog | Adds ~50KB, overkill for single panel use case |
| Custom panel | @radix-ui/react-dialog | Similar size, provides more than needed |
| Native CSS transitions | framer-motion | Unnecessary complexity for simple slide |
| Click-outside handler | react-click-outside | Native approach already used in codebase |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Component Structure
```
app/
├── components/
│   ├── StoryDetailPanel.tsx   # New: slide-in panel shell
│   ├── StoryCard.tsx          # Modified: add expand button
│   └── KanbanBoard.tsx        # Modified: manage panel state
```

### Pattern 1: Controlled Panel State at Board Level

**What:** Panel open/close state lives in `KanbanBoard.tsx`, passed down to `StoryCard` and `StoryDetailPanel`
**When to use:** When single panel serves all cards in a parent container
**Example:**
```typescript
// KanbanBoard.tsx
const [selectedStory, setSelectedStory] = useState<KanbanStory | null>(null);

const handleOpenDetail = (story: KanbanStory) => {
  setSelectedStory(story);
};

const handleCloseDetail = () => {
  setSelectedStory(null);
};

return (
  <>
    {/* columns render StoryCard with onOpenDetail prop */}
    {selectedStory && (
      <StoryDetailPanel
        story={selectedStory}
        onClose={handleCloseDetail}
      />
    )}
  </>
);
```

### Pattern 2: Fixed Position Panel with Overlay

**What:** Panel uses `fixed inset-y-0 right-0` with semi-transparent overlay behind
**When to use:** Full-height slide-in panels
**Example:**
```typescript
// Source: FileViewer.tsx pattern + TailwindCSS docs
<div className="fixed inset-0 z-50">
  {/* Overlay - click to close */}
  <div
    className="absolute inset-0 bg-gray-900/80"
    onClick={onClose}
    aria-hidden="true"
  />
  {/* Panel - slides from right */}
  <div
    className="absolute inset-y-0 right-0 w-full max-w-md bg-gray-900
               transform transition-transform duration-300 ease-out"
    style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
  >
    {/* Panel content */}
  </div>
</div>
```

### Pattern 3: Expand Button with stopPropagation

**What:** Button on card that opens panel without triggering drag
**When to use:** Interactive elements on draggable containers
**Example:**
```typescript
// Source: Existing StoryCard.tsx patterns
<button
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevents drag from starting
    onOpenDetail?.();
  }}
  className="p-1 text-gray-400 hover:text-blue-400"
  title="View details"
>
  <Expand className="w-4 h-4" />
</button>
```

### Anti-Patterns to Avoid

- **Inline panel state per card:** Creates multiple potential panels, complicates which is open
- **Portal without need:** Fixed positioning works fine, portal adds complexity for SSR
- **CSS-only animation toggle:** Need JS control for entrance timing and accessibility
- **No body scroll lock:** Users scroll background accidentally when panel is open

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap | Custom tab navigation loop | Simple approach: auto-focus close button | Full focus trap overkill for v1 panel |
| Animation library | CSS keyframe system | TailwindCSS `transition-*` utilities | Built-in, tree-shakable |
| Click outside detection | Event listener math | Overlay div with `onClick` | Simpler, more reliable |
| Escape key handler | Complex key management | Simple `useEffect` with `document.addEventListener` | Already proven in codebase |

**Key insight:** The codebase already has solved click-outside (overlay pattern in FileViewer), escape key (FileViewer), and body scroll lock (FileViewer). Reuse these exact patterns.

## Common Pitfalls

### Pitfall 1: Button Click Triggers Drag Start

**What goes wrong:** Clicking expand button starts card drag instead of opening panel
**Why it happens:** Event bubbles up to draggable parent
**How to avoid:** `e.stopPropagation()` on button click handler
**Warning signs:** Card follows cursor after clicking expand button

### Pitfall 2: Panel Opens Behind Other Content

**What goes wrong:** Panel renders but is obscured by kanban columns
**Why it happens:** Insufficient z-index or missing `fixed` positioning
**How to avoid:** Use `z-50` on panel container, ensure `fixed` not `absolute`
**Warning signs:** Panel partially visible, columns render on top

### Pitfall 3: Animation Doesn't Play on Open

**What goes wrong:** Panel appears instantly without slide animation
**Why it happens:** Component mounts already in "open" position
**How to avoid:** Mount with `translateX(100%)`, then update state to `translateX(0)` after initial render
**Warning signs:** No visual slide, panel just "pops" in

### Pitfall 4: Scroll Position Resets on Close

**What goes wrong:** After closing panel, kanban board scrolled to different position
**Why it happens:** Body scroll lock implementation interferes
**How to avoid:** Save/restore `scrollY` in body scroll lock effect
**Warning signs:** User loses their place in kanban columns after viewing detail

### Pitfall 5: Multiple Rapid Opens

**What goes wrong:** User clicks multiple expand buttons quickly, gets inconsistent state
**Why it happens:** State updates not settling before next click
**How to avoid:** Panel component controls single story at a time (set new story replaces old)
**Warning signs:** Panel flickers or shows wrong story content

## Code Examples

Verified patterns from existing codebase:

### Escape Key Handler
```typescript
// Source: /app/welcome/FileViewer.tsx:20-29
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };
  document.addEventListener("keydown", handleEscape);
  return () => document.removeEventListener("keydown", handleEscape);
}, [onClose]);
```

### Body Scroll Lock
```typescript
// Source: /app/welcome/FileViewer.tsx:31-38
useEffect(() => {
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = originalOverflow;
  };
}, []);
```

### Overlay Click to Close
```typescript
// Source: /app/welcome/FileViewer.tsx:44-46
<div
  className="fixed inset-0 z-50 bg-gray-900 bg-opacity-95"
  onClick={onClose}
  role="dialog"
  aria-labelledby="panel-title"
  aria-modal="true"
>
```

### Stop Propagation on Interactive Elements
```typescript
// Source: /app/components/StoryCard.tsx:186
onClick={(e) => { e.preventDefault(); e.stopPropagation(); /* action */ }}
```

### TailwindCSS Slide Animation
```typescript
// Source: TailwindCSS docs - transition utilities
// Panel container
className={`
  fixed inset-y-0 right-0 w-full max-w-md
  bg-gray-900 border-l border-gray-700
  transform transition-transform duration-300 ease-out
  ${isVisible ? 'translate-x-0' : 'translate-x-full'}
`}
```

### Lucide Icon Import
```typescript
// Source: lucide-react npm package docs
import { X, Expand, ChevronRight } from 'lucide-react';

// Usage
<X className="w-5 h-5" />
<Expand className="w-4 h-4" />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| createPortal for all modals | Fixed positioning when SSR matters | React Router 7 SSR era | Portal hydration issues avoided |
| focus-trap-react always | Simple focus management for non-form panels | Accessibility matured | Less dependency overhead |
| JS animation libraries | CSS transitions with Tailwind | TailwindCSS v3+ | Better performance, smaller bundles |

**Deprecated/outdated:**
- `ReactDOM.unstable_renderSubtreeIntoContainer` - ancient, use createPortal if needed
- CSS `will-change` everywhere - now considered micro-optimization

## Open Questions

1. **Entrance Animation Timing**
   - What we know: CSS transition works when toggling class
   - What's unclear: Optimal duration (200ms? 300ms? 500ms?)
   - Recommendation: Start with 300ms, adjust based on feel

2. **Panel Width on Mobile**
   - What we know: Desktop should be max-w-md (~28rem)
   - What's unclear: Should it be full-width on mobile?
   - Recommendation: Use `w-full max-w-md` - full on mobile, capped on desktop

## Sources

### Primary (HIGH confidence)
- `/app/welcome/FileViewer.tsx` - Existing modal patterns in this codebase
- `/app/components/StoryCard.tsx` - Drag handling and event bubbling patterns
- [TailwindCSS transition docs](https://tailwindcss.com/docs/transition-property) - Animation utilities

### Secondary (MEDIUM confidence)
- [Headless UI Dialog](https://headlessui.com/react/dialog) - Verified Dialog pattern structure
- [Lucide React](https://lucide.dev/guide/packages/lucide-react) - Icon component API
- [React Portals docs](https://react.dev/reference/react-dom/createPortal) - When to use portals

### Tertiary (LOW confidence)
- Web search results for focus trapping - general pattern guidance (not critical for v1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using only existing dependencies
- Architecture: HIGH - Follows proven patterns already in codebase
- Pitfalls: HIGH - Based on actual code review of existing components

**Research date:** 2026-01-25
**Valid until:** 30 days (stable patterns, no expected changes)
