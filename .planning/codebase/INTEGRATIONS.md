# External Integrations

**Analysis Date:** 2026-01-25

## APIs & External Services

**Claude CLI Integration:**
- Service: Local Claude command-line tool
- What it's used for: Starting new sessions, sending prompts, managing active sessions
- Client: `app/claude-cli.server.ts` via Node.js child_process
- Auth: Uses system PATH to locate `claude` binary via `which` command
- Methods:
  - `newSession()` - Create new Claude Code session
  - `sendPrompt()` - Send message to active session
  - `cancelProcess()` - Cancel running session

**Google Fonts API:**
- Service: Google Fonts CDN
- What it's used for: Loading Inter font family
- URLs:
  - `https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap`
  - Preconnect: `https://fonts.googleapis.com`, `https://fonts.gstatic.com`
- Loaded in: `app/root.tsx` via Link headers

## Data Storage

**Local Filesystem (Only):**
- Primary storage: `~/.claude/projects/` directory structure
- Data format: JSONL (JSON Lines) files
  - Filename: `{sessionId}.jsonl`
  - Location: `~/.claude/projects/{projectName}/{sessionId}.jsonl`
- No external database or persistent storage backend
- No caching layer or cache backend

**Project Structure:**
```
~/.claude/projects/
├── project-1/
│   ├── session-id-1.jsonl
│   ├── session-id-2.jsonl
│   └── session-id-3.jsonl
├── project-2/
│   └── session-id-4.jsonl
```

**File Operations:**
- Read-only by default for safety
- Session files read via: `fs.readFile()`, `fs.readdir()`
- Kanban state persisted to: `~/.claude/projects/.kanban/state.json` (created by `app/utils/kanban.server.ts`)

## Authentication & Identity

**Auth Provider:**
- Custom: Uses system user context
- No centralized auth system
- Access control: Based on file system permissions to `~/.claude/projects`
- Session identification: Uses local file paths and system user context

## Monitoring & Observability

**Error Tracking:**
- None integrated

**Logs:**
- Application logs: console output (dev) and stderr (production)
- Session stream logs: Available via `api.sessions.$project.$sessionId.stream` endpoint
  - Server-sent events (SSE) for real-time log streaming
  - Supports pagination via `fromLine` and `dir` query parameters
- CLI output captured in `app/claude-cli.server.ts`

**Development Logging:**
- Background process logs: `tmp/output.log` (created by background scripts)
- Check status: `pnpm run bg:status`

## CI/CD & Deployment

**Hosting:**
- Self-hosted on Node.js servers
- Docker support: Multi-stage Dockerfile (`Dockerfile`)
  - Base: `node:20-alpine`
  - Build stages: deps, build, prod-deps, production
- No cloud provider integrations detected

**CI Pipeline:**
- None detected in codebase
- Manual build process: `pnpm build && pnpm start`

## Environment Configuration

**Required Environment Variables:**
- `VITE_DEV_HOST` - Dev server host (optional, default: localhost)
- `VITE_DEV_PORT` - Dev server port (optional, default: 5174)
- `VITE_ALLOWED_HOSTS` - Comma-separated allowed hosts (optional, default: localhost)
- `NODE_ENV` - Set to "production" in Docker container

**Optional/Development Variables:**
- Tailscale network support via `VITE_ALLOWED_HOSTS` (e.g., `.ts.net`)

**Secrets Location:**
- `.env.example` - Template for environment variables
- `.env.development.local` - Local development overrides (checked in for team)
- `process.env.HOME` - Used to locate `~/.claude/projects` directory

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected
- API routes are read-only (GET/POST for state retrieval) with no external callbacks

## Cost Tracking Integration

**ccusage Library Usage:**
- Package: ccusage 16.2.3
- Purpose: Calculate Claude API costs from session data
- Location: `app/routes/api.sessions.costs.ts`
- Features:
  - Offline pricing via `PricingFetcher(true)`
  - Per-session cost calculation
  - Dynamic scaling for cost visualization (green/yellow/red thresholds)
  - Percentile-based scaling for cost display

**Session Cost Calculation:**
```typescript
// From api.sessions.costs.ts
const [{ PricingFetcher }, { calculateCostForEntry }] = await Promise.all([
  import("ccusage/pricing-fetcher"),
  import("ccusage/data-loader"),
]);
const fetcher = new PricingFetcher(true); // offline pricing
```

## Network Configuration

**Dev Server Binding:**
- Host: Configurable via `VITE_DEV_HOST` (default: localhost)
- Port: 5174 (configurable via `VITE_DEV_PORT`)
- Allowed hosts: Configurable via `VITE_ALLOWED_HOSTS`
  - Supports exact hosts, IP addresses, and domain suffixes
  - Example: `.ts.net` allows all Tailscale network subdomains

**Production Server:**
- Served via `@react-router/serve`
- Default port: 3000 (can be overridden)
- No external proxy required

## API Routes (Internal)

**Session APIs:**
- `GET /api/sessions/costs?project={name}` - Cost aggregation for project sessions
- `GET /api/sessions/previews` - Session preview data
- `GET /api/sessions/{project}/{sessionId}/stream?fromLine={n}&dir={asc|desc}` - SSE stream for session logs
- `GET /api/sessions/{project}/{sessionId}/active` - Check if session is running
- `GET /api/sessions/{project}/active-status` - Project-wide active session status
- `POST /api/sessions/{project}/{sessionId}/cancel` - Cancel running session

**Kanban APIs:**
- `GET /api/kanban/state` - Get current kanban board state
- `POST /api/kanban/state` - Update kanban board state
- `POST /api/kanban/stories/{storyId}` - Update story card data

---

*Integration audit: 2026-01-25*
