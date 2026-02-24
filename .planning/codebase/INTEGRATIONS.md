# External Integrations

**Analysis Date:** 2026-01-26

## APIs & External Services

**Google Fonts:**
- Service: Google Fonts CDN
- What it's used for: Font delivery (Inter font family)
- Integration: HTML preconnect in `app/root.tsx`
  - https://fonts.googleapis.com (preconnect)
  - https://fonts.gstatic.com (preconnect)
  - https://fonts.googleapis.com/css2?family=Inter... (stylesheet)

**Claude Pricing Service (ccusage):**
- Service: Internal package for Claude token pricing
- SDK: ccusage 16.2.3
- What it's used for: Calculate costs for Claude Code sessions
- Integration Points:
  - `app/routes/api.sessions.costs.ts` - Batch cost calculations for all sessions
  - `app/routes/$project.sessions.$sessionId.tsx` - Per-session cost display
  - `app/routes/api.sessions.$project.$sessionId.totals.ts` - Session summary totals
  - `app/utils/file-tail.server.ts` - Real-time cost calculation for streaming sessions
- Pricing Mode: Offline only (no network fetches, uses embedded pricing data)
- Import method: Dynamic import (`await import("ccusage/pricing-fetcher")`)

## Data Storage

**Databases:**
- Not detected - Application is read-only file system based

**File Storage:**
- Local filesystem only
- Reads Claude Code session files from `~/.claude/projects/`
- Session files stored as `.jsonl` format (JSON Lines)
- Path safety: Validated through `resolveProjectDir()` and `resolveSessionFile()` in `app/utils/path-safety.server.ts`
- File watching: Real-time file tail via `app/utils/file-tail.server.ts`
  - Watches for new lines appended to session files
  - Manages subscriptions to file changes
  - Lazy-loads cost calculation on demand

**Caching:**
- In-memory caching of file tailers with 60-second TTL (TAILER_IDLE_TTL_MS = 60,000ms)
- Managed via `FileTailerRegistry` in `app/utils/file-tail.server.ts`

## Authentication & Identity

**Auth Provider:**
- None - Application is read-only visualization tool with no user accounts
- No authentication or authorization layer

## Monitoring & Observability

**Error Tracking:**
- Not detected - No error tracking service integration

**Logs:**
- Console logging via `console.log()` and `console.warn()` for:
  - Process management in `app/claude-cli.server.ts`
  - Session state changes
  - File watching events

**Development:**
- Dev console errors displayed inline in dev mode (`import.meta.env.DEV` check in `app/root.tsx`)

## CI/CD & Deployment

**Hosting:**
- Self-hosted via Docker (multi-stage Dockerfile provided)
- Can be deployed to any Node.js container platform
- Development server: Vite dev server with configurable port (default 5174)
- Production server: React Router Serve

**CI Pipeline:**
- Not detected - No CI/CD configuration in repository

## Environment Configuration

**Required env vars:**
- VITE_DEV_HOST - Dev server bind address (default: localhost)
- VITE_DEV_PORT - Dev server port (default: 5174)
- VITE_ALLOWED_HOSTS - Comma-separated allowed hosts for dev server
- Node.js HOME environment variable (passed through to child processes in `app/claude-cli.server.ts`)

**Example configuration:**
```bash
VITE_DEV_HOST=0.0.0.0
VITE_DEV_PORT=5174
VITE_ALLOWED_HOSTS=localhost,<your-tailscale-ip>,<your-hostname>.ts.net,.ts.net
```

**Secrets location:**
- `.env.development.local` - Development environment (git-ignored)
- `.env.example` - Template for required variables

## Local System Integration

**Claude CLI Integration:**
- Spawns Claude CLI child processes for:
  - Starting new sessions: `claude --init --session-id {sessionId} --working-directory {dir}`
  - Resuming sessions: `claude --resume {sessionId}`
  - Sending prompts to active sessions
- Managed in `app/claude-cli.server.ts`
- Process tracking: In-memory Map of active processes with UUID validation
- Signals: SIGINT for cancellation, SIGKILL as fallback

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Network Configuration

**Dev Server:**
- Binds to configurable host (can accept external connections)
- Port: 5174 (configurable via VITE_DEV_PORT)
- Tailscale network support enabled in default config
- CORS: No explicit CORS configuration (defaults to same-origin)

---

*Integration audit: 2026-01-26*
