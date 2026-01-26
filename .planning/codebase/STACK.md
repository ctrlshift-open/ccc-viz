# Technology Stack

**Analysis Date:** 2026-01-26

## Languages

**Primary:**
- TypeScript 5.8.3 - Full-stack application (React components, routes, utilities, and server logic)
- CSS 4 - Via TailwindCSS for styling

## Runtime

**Environment:**
- Node.js 20+ (specified in `package.json` engines)

**Package Manager:**
- pnpm 10.11.0
- Lockfile: Present (`pnpm-lock.yaml`)

## Frameworks

**Core:**
- React Router 7.7.1 - Full-stack framework with SSR, file-based routing, and server-side actions
- React 19.1.0 - UI library with latest features
- Vite 6.3.3 - Build tool and dev server
- React 19 with JSX compilation

**Styling:**
- TailwindCSS 4.1.4 - Utility-first CSS framework
- @tailwindcss/vite 4.1.4 - Vite plugin for TailwindCSS

**Testing:**
- Vitest 2.1.1 - Unit test runner (configured in `vitest.config.ts`)
- Playwright 1.56.1 - E2E testing framework (configured in `playwright.config.ts`)
- @playwright/test 1.48.2 - Test utilities

**Build/Dev:**
- @react-router/dev 7.7.1 - React Router development tools
- @react-router/fs-routes 7.8.2 - File-based routing system
- @react-router/node 7.7.1 - Node.js runtime integration
- @react-router/serve 7.7.1 - Production server for built output
- vite-tsconfig-paths 5.1.4 - Resolves TypeScript path aliases in Vite

## Key Dependencies

**Critical:**
- ccusage 16.2.3 - Claude usage pricing calculator with offline pricing data
  - Used for computing token costs for Claude sessions
  - Dynamically imported in loaders to avoid client-side bundle pollution

**UI/Rendering:**
- react-markdown 9.0.3 - Markdown rendering for session content display
- lucide-react 0.542.0 - Icon library for UI components
- ansi_up 6.0.6 - ANSI color code parser for terminal output rendering

**Utilities:**
- nanoid 5.1.6 - Lightweight unique ID generation
- isbot 5.1.27 - Bot detection for headers/logging

## Configuration

**Environment:**
- Vite environment variables with `VITE_` prefix
- VITE_DEV_HOST - Dev server bind address (default: localhost, can be 0.0.0.0)
- VITE_DEV_PORT - Dev server port (default: 5174)
- VITE_ALLOWED_HOSTS - Comma-separated list of allowed hosts for dev server
- See `.env.example` and `.env.development.local` for reference configurations

**Build:**
- `vite.config.ts` - Main Vite configuration
  - Tailwind CSS plugin integration
  - React Router Vite plugin
  - TypeScript path alias resolution
  - Dev server with configurable host/port/allowed hosts
- `react-router.config.ts` - React Router specific config (SSR enabled)
- `tsconfig.json` - TypeScript compiler configuration
  - Target: ES2022
  - Module resolution: bundler
  - Path alias: `~/` points to `./app/`
  - JSX: react-jsx (automatic JSX runtime)
  - Strict mode enabled

## Platform Requirements

**Development:**
- Node.js 20 or higher
- pnpm package manager
- Modern terminal for dev server (supports Tailscale network access)

**Production:**
- Node.js 20-alpine Docker image
- Multi-stage Docker build for optimized image size
- Vite-optimized build output
- React Router server runtime

## Docker & Deployment

**Container Image:**
- Base: node:20-alpine (lightweight)
- Multi-stage build:
  1. Dependencies stage - installs all deps
  2. Build stage - compiles TypeScript/Vite assets
  3. Production deps - prunes to production only
  4. Final stage - runs built application
- Env: NODE_ENV=production
- Exposed port: 5174 (can be remapped at runtime)
- Entry: `pnpm start` (runs `react-router-serve ./build/server/index.js`)

---

*Stack analysis: 2026-01-26*
