# Technology Stack

**Analysis Date:** 2026-01-25

## Languages

**Primary:**
- TypeScript 5.9.2 - Application logic, routes, components, utilities
- JSX/TSX - React component syntax

**Secondary:**
- JavaScript - Configuration files (ESM modules), CLI wrapper

## Runtime

**Environment:**
- Node.js >= 20 (specified in `package.json` engines field)
- Alpine Linux 3.20 (Docker base image: `node:20-alpine`)

**Package Manager:**
- pnpm 10.11.0+sha512...
- Lockfile: `pnpm-lock.yaml` (9.0 format)

## Frameworks

**Core:**
- React 19.1.1 - UI component framework
- React Router 7.8.2 - Full-stack routing with SSR support
- React DOM 19.1.1 - DOM rendering

**Styling:**
- TailwindCSS 4.1.12 - Utility-first CSS framework
- @tailwindcss/vite 4.1.12 - Vite integration for Tailwind

**Testing:**
- Vitest 2.1.9 - Unit test runner
- @playwright/test 1.55.0 - E2E testing framework
- Playwright 1.56.1 - Browser automation

**Build/Dev:**
- Vite 6.3.5 - Build tool and dev server
- @react-router/dev 7.8.2 - React Router dev integration
- @react-router/serve 7.8.2 - Production server
- @react-router/fs-routes 7.8.2 - File-based routing
- @react-router/node 7.8.2 - Node.js runtime adapter
- vite-tsconfig-paths 5.1.4 - TypeScript path alias resolution

## Key Dependencies

**Critical:**
- ccusage 16.2.3 - Claude usage cost calculation and pricing fetcher
  - Used in: `app/routes/api.sessions.costs.ts` for computing session costs
  - Provides: `PricingFetcher`, `calculateCostForEntry` for cost analytics
- react-markdown 9.0.3 - Markdown rendering in session views
- lucide-react 0.542.0 - Icon library for UI components
- nanoid 5.1.6 - Unique ID generation
- ansi_up 6.0.6 - ANSI color code parsing for terminal output rendering

**Infrastructure:**
- isbot 5.1.30 - Bot detection middleware
- @types/node 20.19.11 - Node.js type definitions
- @types/react 19.1.12 - React type definitions
- @types/react-dom 19.1.9 - React DOM type definitions

## Configuration

**Environment:**
- Development: `.env.development.local`
  - `VITE_DEV_HOST` - Dev server host (default: localhost, example: 0.0.0.0)
  - `VITE_ALLOWED_HOSTS` - Comma-separated hosts allowed to connect (default: localhost)
  - Example hosts: `localhost,100.96.167.84,.ts.net` (Tailscale support)
- Example file: `.env.example` provided for reference

**Build:**
- `react-router.config.ts` - React Router configuration with SSR enabled
- `vite.config.ts` - Vite build config with plugins: tailwindcss, reactRouter, tsconfigPaths
- `tsconfig.json` - TypeScript compiler options
  - Target: ES2022
  - Module: ES2022
  - Path alias: `~/*` → `./app/*`
  - Strict mode enabled
  - JSX: react-jsx

**Test Configuration:**
- `vitest.config.ts` - Vitest test runner config
- `playwright.config.ts` - E2E test config
  - Base URL: http://localhost:5174
  - Web server: `pnpm dev`

## Platform Requirements

**Development:**
- Node.js >= 20
- pnpm package manager
- Git for version control
- Port 5174 available (default dev server port, configurable via `VITE_DEV_PORT`)

**Production:**
- Node.js >= 20
- Prebuilt `/build` directory containing:
  - `build/server/index.js` - SSR server bundle
  - `build/client/**` - Static client assets
- HTTP server on configurable port (default: 3000 from `@react-router/serve`)
- Read access to `~/.claude/projects` directory (local filesystem)

## Build Output

**Directories:**
- `build/server/` - Server bundle for production (SSR)
- `build/client/` - Static assets and client bundle
- `build/public/` - Static resources

**Execution:**
- Development: `pnpm dev` starts Vite dev server on port 5174
- Production: `pnpm start` or `pnpm react-router-serve ./build/server/index.js`
- CLI: `npx cc-viz@latest` via bin/cc-viz.js wrapper

---

*Stack analysis: 2026-01-25*
