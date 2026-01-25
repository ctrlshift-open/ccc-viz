# Session Markdown File Viewer - Implementation Plan

## Overview
Add a "Files" tab to session detail view that displays new/modified .md files from the project directory with a mobile-optimized full-screen viewer.

## Requirements
- Show only .md files with new or changed git status (new, modified, untracked)
- Add "Files" tab alongside existing message type filters
- Full-screen modal viewer optimized for mobile viewing
- Reuse existing `react-markdown` setup and mobile-responsive patterns

## Implementation Steps

### 1. Add Git Status Detection to Session Loader
**File**: `app/routes/$project.sessions.$sessionId.tsx`

- Extend the existing loader to detect modified .md files
- Use dynamic import for `node:child_process` (SSR module boundary safety)
- Run `git status --porcelain` in the project's working directory
- Filter results for:
  - New files (status `??` or `A`)
  - Modified files (status `M`)
  - File extension `.md`
- Return file list with relative paths from project root

**Implementation details**:
```typescript
// In loader function (after existing session data loading)
const { execSync } = await import("node:child_process");
const gitStatus = execSync("git status --porcelain", {
  cwd: projectDir,
  encoding: "utf-8"
});

const modifiedMdFiles = gitStatus
  .split("\n")
  .filter(line => line.trim())
  .map(line => {
    const status = line.substring(0, 2).trim();
    const filepath = line.substring(3).trim();
    return { status, filepath };
  })
  .filter(({ status, filepath }) =>
    (status === '??' || status === 'A' || status === 'M') &&
    filepath.endsWith('.md')
  );
```

### 2. Create File Reading Action/Loader
**File**: `app/routes/$project.sessions.$sessionId.tsx`

Add a new action handler to safely read file contents:

- Accept `fileId` parameter (relative path to .md file)
- Use `resolveProjectDir()` + path validation to prevent traversal attacks
- Dynamically import `node:fs/promises` and `node:path`
- Read file contents and return as JSON
- Handle errors (file not found, permission denied)

**Safety checks**:
- Validate file is within project directory bounds
- Ensure file path doesn't contain `..` after resolution
- Check file exists and is readable
- Limit file size (e.g., max 1MB for performance)

### 3. Add "Files" Tab to UI
**File**: `app/routes/$project.sessions.$sessionId.tsx`

Extend the existing filter bar UI:

- Add "Files" option to message type filters (currently: All, Human, Assistant, etc.)
- Show file count badge if modified .md files exist
- When selected, hide message list and show file grid
- Mobile-first design matching existing patterns

**UI Structure**:
```
[All] [Human] [Assistant] [Commands] [Files (3)] 👈 New tab
```

### 4. Build File Grid Component
**File**: `app/routes/$project.sessions.$sessionId.tsx` (inline component)

Create a responsive grid showing available files:

- Card-based layout with file icon, name, git status badge
- Mobile: 1 column, padding for touch targets
- Desktop: 2-3 columns with gap
- Each card clickable to open full-screen viewer
- Show file metadata: status (New/Modified), file size, last modified

**Mobile optimizations**:
- `p-4 space-y-3` for comfortable spacing
- `min-h-[80px]` for adequate touch targets
- `text-sm` for readable file names
- Status badges with color coding (green=new, yellow=modified)

### 5. Create Full-Screen Modal Viewer
**New Component**: `FileViewer.tsx` in `app/welcome/`

Build a mobile-optimized modal overlay:

**Structure**:
- Full-screen overlay (`fixed inset-0 z-50 bg-gray-900`)
- Header bar with:
  - Close button (top-left, large touch target)
  - File name (truncated with ellipsis)
  - Status badge
- Scrollable content area
- Footer with file metadata (optional)

**Mobile optimizations**:
- `overflow-y-auto overscroll-contain` for smooth scrolling
- `p-4 md:p-8` for responsive padding
- `max-w-screen-md mx-auto` to limit width on desktop
- Safe area insets for iOS notches
- Tap outside to close (backdrop click)
- Escape key to close (desktop)

**Content rendering**:
- Reuse `TextOrMarkdown` component from session view
- Same custom component overrides for headings, code, tables
- Responsive text sizing: `text-sm md:text-base`
- Code blocks with horizontal scroll on mobile

### 6. State Management for Modal
**Implementation**: React state + URL search params

- Use `useState` for modal open/close
- Use URL search param `?file=path/to/file.md` for deep linking
- Fetch file content on modal open via `useFetcher`
- Loading state while fetching
- Error handling if file read fails

**Benefits**:
- Shareable URLs to specific files
- Browser back button closes modal
- No full page reload when opening/closing

### 7. Loading & Error States

**Loading**:
- Skeleton loader while fetching file content
- Spinner with "Loading file..." message
- Maintain modal open state during load

**Error handling**:
- File not found: "This file no longer exists"
- Permission denied: "Cannot read file (permission denied)"
- File too large: "File exceeds size limit"
- Git error: "Could not detect file changes"
- Show error in modal with retry button

### 8. Accessibility & UX Polish

**Keyboard navigation**:
- Focus trap within modal when open
- Tab through close button and content links
- Escape key closes modal

**Screen readers**:
- `role="dialog"` and `aria-labelledby` on modal
- `aria-label="Close file viewer"` on close button
- Announce file count to screen readers

**Touch interactions**:
- Swipe down gesture to close modal (nice-to-have)
- Smooth scroll momentum
- Prevent body scroll when modal open

**Visual feedback**:
- Active/hover states on file cards
- Transition animations for modal open/close
- Loading shimmer effect

## Technical Considerations

### SSR Module Boundaries
- ALL Node.js imports (`node:*`, `child_process`, `fs`) MUST be dynamic imports inside loader/action
- Never import at top level (causes "externalized for browser compatibility" error)

### Path Security
- Use existing `resolveProjectDir()` from `path-safety.server.ts`
- Validate all file paths against project directory
- Never pass user input directly to file system operations

### Performance
- Limit file size (1MB max for .md files)
- Consider pagination if project has many modified files (>50)
- Cache git status results for short duration (30s)
- Lazy load file content (only fetch when modal opens)

### Mobile Testing
- Test on iOS Safari (Safe Area insets)
- Test on Android Chrome (viewport units)
- Verify touch targets are >44px
- Test landscape orientation
- Test with device keyboard open

## Files to Modify

1. `app/routes/$project.sessions.$sessionId.tsx`
   - Extend loader to detect git status
   - Add file reading action
   - Add "Files" tab to filter bar
   - Add file grid component
   - Integrate modal viewer

2. `app/welcome/FileViewer.tsx` (NEW)
   - Full-screen modal component
   - File content rendering
   - Mobile-optimized layout

3. `tmux-urls.cfg` (update if needed)
   - Add any new dev URLs for testing

## Testing Checklist

- [ ] Git status detection works for new/modified .md files
- [ ] Path traversal attacks blocked (test with `../../etc/passwd`)
- [ ] Files tab shows correct file count
- [ ] File grid displays on mobile and desktop
- [ ] Modal opens and displays markdown correctly
- [ ] Modal closes via close button, backdrop, and escape key
- [ ] Deep linking works (`?file=README.md`)
- [ ] Error handling for missing files
- [ ] Responsive layout on mobile (360px to 428px width)
- [ ] Safe area insets on iOS devices
- [ ] Code blocks scroll horizontally on narrow screens
- [ ] Tables render properly on mobile

## Success Criteria

✅ Users can view new/modified .md files from the "Files" tab
✅ Mobile-optimized full-screen viewer with smooth scrolling
✅ Safe file access with no security vulnerabilities
✅ Deep linkable file URLs
✅ Graceful error handling
✅ Consistent with existing UI patterns and mobile optimizations
