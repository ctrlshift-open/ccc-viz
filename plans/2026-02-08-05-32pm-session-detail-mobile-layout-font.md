# Session Detail: Mobile Layout & Font Tweaks

## Context
Mobile view needs 4 adjustments based on annotated screenshot feedback. All changes in `app/routes/$project.sessions.$sessionId.tsx`.

---

## 1. Red Box: Hamburger + Title Same Line

Fill the empty space to the right of the hamburger by putting the title inline with it.

- **Line 977** main container: `pt-16 md:pt-14` -> `pt-4 md:pt-14` (align content with hamburger's `top-4`)
- **Line 978** h1: add `pl-14 md:pl-0` (56px left padding clears the ~40px hamburger button)
- **Line 981** session ID `<p>`: add `pl-14 md:pl-0`

## 2. Green Box: Compact Expand Types to 2 Lines

Remove counts, reduce padding, tighten spacing.

- **Line 1182** container: `p-2` -> `p-1.5`, inner `gap-2` -> `gap-1.5`
- **Line 1195** category buttons: `px-2 py-1 rounded border text-sm` -> `px-1.5 py-0.5 rounded border text-xs`
- **Line 1200** remove count spans: delete `<span className="text-xs">({c.count})</span>`
- **Line 1184** "Expand types:" label: `text-xs sm:text-sm` -> `text-xs`
- **Lines 1205-1249** action links: `text-xs sm:text-sm` -> `text-xs` throughout
- Remove pipe separator before "Expand all" (line 1204)

## 3. Yellow Box: Move Status Line Before Messages

Move the mobile metrics div (lines 995-1022) from its current position (after session ID, before nav links) to just before the Messages/Files tabs (after line 1148, before line 1151).

Current order on mobile:
```
h1 title -> session ID -> METRICS -> nav links -> Messages|Files -> expand types
```

New order:
```
h1 title -> session ID -> nav links -> METRICS -> Messages|Files -> expand types
```

## 4. Blue Box: Bigger Expanded Message Text

Bump every text size up one Tailwind step:

| Element | Line | From | To |
|---|---|---|---|
| `SafePre` | 1471 | `text-xs sm:text-sm` | `text-sm sm:text-base` |
| Markdown wrapper | 1598 | `text-xs` | `text-sm sm:text-base` |
| Markdown h1 | 1601 | `text-lg sm:text-xl` | `text-xl sm:text-2xl` |
| Markdown h2 | 1602 | `text-base sm:text-lg` | `text-lg sm:text-xl` |
| Markdown h3 | 1603 | `text-base` | `text-base sm:text-lg` |
| Inline code | 1619 | `text-sm` | `text-base` |
| Table | 1629 | `text-sm` | `text-base` |
| Plain text | 1643 | `text-sm sm:text-base` | `text-base sm:text-lg` |

---

## Verification
1. `pnpm dev` -> open on mobile viewport
2. Hamburger and title sit on same line, no wasted space
3. Expand types fits in ~2 lines without counts
4. Stats line (model, cost, context, timing) appears right before Messages/Files tabs
5. Expand a message -> text is noticeably larger
6. No horizontal overflow on mobile
7. Desktop view unchanged
