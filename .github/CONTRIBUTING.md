# Contributing to cc-viz

Thanks for your interest in contributing! This repo visualizes Claude Code session logs from `~/.claude/projects/*`. The project is TypeScript-first, React 19, React Router 7, and Tailwind v4.

## Quick Start

- Requirements: Node 20+, PNPM (`corepack enable`), macOS/Linux/WSL recommended
- Install: `pnpm install`
- Dev: `pnpm dev` (defaults to http://localhost:5174)
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Build: `pnpm build`
- Prod serve: `pnpm start` (serves `./build/server/index.js`)

## Project Structure

- Source: `app/` (entry `app/root.tsx`; routes in `app/routes/`; UI in `app/welcome/`)
- Routing: `app/routes.ts` defines file-based routes
- Assets: `public/` (served at `/`); Tailwind styles in `app/app.css`
- Config: `react-router.config.ts` (SSR), `vite.config.ts` (plugins), `tsconfig.json` (path alias `~/* -> app/*`)

## Style Guidelines

- Language: TypeScript (strict), React 19, React Router 7, Tailwind v4
- Indentation: 2 spaces; quotes: double
- Files: lower-kebab or lowercase (e.g., `app/routes/home.tsx`)
- Components: PascalCase exports (e.g., `export function Welcome() {}`)
- Imports: prefer `~/*` alias (e.g., `import { Welcome } from "~/welcome/welcome"`)

## Security & Privacy

- Never commit secrets. Use environment variables.
- This app reads user-local data under `~/.claude/projects`. Do not expose the dev server to untrusted networks without authentication.
- Server loaders validate route params and restrict filesystem access to the base directory.

## Pull Requests

- Prefer Conventional Commits (`feat:`, `fix:`, `chore:`)
- Include a concise description, linked issues, and UI screenshots/GIFs when relevant.
- Ensure `pnpm typecheck`, `pnpm build`, and local run succeed.

## Tests

- Frameworks: Vitest + React Testing Library
- Location: co-locate or `app/__tests__/`; name `*.test.ts(x)`
- Cover route loaders/actions and critical components when possible.

### Optional E2E (Playwright)

- Install browsers once: `pnpm exec playwright install`
- Run smoke test: `pnpm e2e`
- Headed mode: `pnpm e2e:headed`
  - The smoke test will spin up the dev server, create a temporary project/session under `~/.claude/projects`, navigate through the UI, then clean up.

## Development Notes

- Dev server host/port can be overridden with env vars `VITE_DEV_HOST` and `VITE_DEV_PORT`.
- Allowed hosts are configurable via `VITE_ALLOWED_HOSTS` (comma-separated).

Thanks again for contributing!
