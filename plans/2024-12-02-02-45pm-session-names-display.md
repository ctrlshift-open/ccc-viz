# Session Names/Summary Display Options

## Problem
Sessions are currently displayed with UUID filenames which aren't user-friendly. We need to show meaningful session information while maintaining good performance.

## Option 1: First Human Message (Fast, Simple)
**Implementation**: Read only the first line of each JSONL file
**Display**: Show the first human message as the session title
**Performance**: ✅ Excellent - Single line read per file
**Pros**: 
- Very fast
- Minimal file I/O
- Shows user's initial request
**Cons**: 
- First message might not be descriptive
- Could be a command like `/start` or `/init`

## Option 2: Lazy-Loaded Previews (Progressive Enhancement)
**Implementation**: 
- Initial load shows UUID only
- Client-side fetches preview data after page load
- API endpoint returns first meaningful message per session
**Display**: UUID initially, then updates with preview
**Performance**: ✅ Excellent initial load, background updates
**Pros**:
- Page loads instantly
- Progressive enhancement
- Can show loading states
**Cons**:
- Requires additional API calls
- Content shifts as previews load

## Option 3: Metadata Cache File (Pre-computed)
**Implementation**: 
- Create `.claude/projects/{project}/.metadata.json` file
- Update it when Claude Code writes sessions
- Contains: session ID, first message, timestamp, message count
**Display**: Read from single metadata file instead of scanning files
**Performance**: ✅ Excellent - Single file read
**Pros**:
- Extremely fast
- Could include additional stats
- One-time computation cost
**Cons**:
- Requires Claude Code changes to maintain metadata
- Could get out of sync

## Option 4: Smart Summary Extraction (Balanced)
**Implementation**: 
- Read first 5-10 lines of each file
- Find first human message that's not a command
- Cache results in memory or localStorage
**Display**: Most relevant early message
**Performance**: ⚠️ Good - Limited reads per file
**Pros**:
- More likely to find meaningful content
- Skips system/command messages
- Still relatively fast
**Cons**:
- Slightly slower than single-line read
- More complex logic

## Option 5: Hybrid Approach (Recommended)
**Implementation**:
1. **Phase 1**: Show UUID with loading indicator
2. **Phase 2**: Read first line server-side for quick preview
3. **Phase 3**: Background fetch for better summary if needed

**Caching Strategy**:
- Store summaries in localStorage with TTL
- Key: `session-summary:{project}:{sessionId}`
- Expire after 24 hours

**Display Format**:
```
[First human message preview - truncated to 100 chars]
Session ID: abc123... | Sep 2 15:20 | 127 messages
```

## Implementation Steps for Recommended Approach

1. **Create server module** `sessions.server.ts`:
   - Function to read first N lines
   - Function to extract meaningful preview
   - Function to get session metadata

2. **Update sessions list loader**:
   - Optionally include preview based on query param
   - Implement pagination if too many sessions

3. **Add client-side enhancement**:
   - Check localStorage for cached summaries
   - Fetch missing summaries in background
   - Update UI progressively

4. **Performance optimizations**:
   - Limit concurrent file reads (max 5-10)
   - Use streaming for large files
   - Implement request debouncing

## Performance Benchmarks to Consider
- 50 sessions × 1 line read = ~50-100ms
- 50 sessions × 5 lines read = ~200-400ms  
- 50 sessions × full file read = 2-5 seconds (unacceptable)
- Single metadata file read = ~5-10ms

## Decision Matrix
| Option | Initial Load | Data Quality | Implementation Effort | Maintenance |
|--------|-------------|--------------|----------------------|-------------|
| First Line | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Lazy Load | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Metadata Cache | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Smart Extract | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Hybrid | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

## Recommendation
Start with **Option 1** (First Human Message) for immediate improvement, then enhance with **Option 2** (Lazy Loading) for better previews without blocking initial page load.