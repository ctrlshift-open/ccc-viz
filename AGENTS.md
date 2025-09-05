# Repository Guidelines

## Project Structure & Module Organization
- Source: `app/` (entry `app/root.tsx`; routes in `app/routes/`; UI in `app/welcome/`).
- Routing: `app/routes.ts` defines file-based routes via `@react-router/dev/routes` (e.g., `index("routes/home.tsx")`).
- Assets: `public/` (served at `/`); Tailwind styles in `app/app.css`.
- Config: `react-router.config.ts` (SSR), `vite.config.ts` (plugins), `tsconfig.json` (path alias `~/* -> app/*`).

## Build, Test, and Development Commands
- `pnpm dev` / `npm run dev`: Start dev server with HMR.
- `pnpm typecheck`: Generate route types and run TypeScript checks.
- `pnpm build`: Build client and server bundles to `build/`.
- `pnpm start`: Run production server (`react-router-serve ./build/server/index.js`).
- Docker: `docker build -t cc-viz . && docker run -p 3000:3000 cc-viz`.

## Coding Style & Naming Conventions
- Language: TypeScript (strict), React 19, React Router 7, Tailwind v4.
- Indentation: 2 spaces; quotes: double `"..."`.
- Files: lower-kebab or lowercase (e.g., `app/routes/home.tsx`, `app/root.tsx`).
- Components: PascalCase exports (e.g., `export function Welcome() {}`).
- Imports: prefer `~/*` alias (e.g., `import { Welcome } from "~/welcome/welcome"`).

## Testing Guidelines
- Frameworks: Prefer Vitest + React Testing Library.
- Location: co-locate or `app/__tests__/`; name `*.test.ts(x)`.
- Scope: Cover route loaders/actions and critical components.
- Run: add tests, then `pnpm test` (script to be added).

## Commit & Pull Request Guidelines
- Commits: Prefer Conventional Commits (`feat:`, `fix:`, `chore:`) for clarity.
- PRs: Provide concise description, linked issues, and UI screenshots/GIFs.
- SSR: Note SSR behavior or changes when relevant.
- Checks: Ensure `pnpm typecheck`, `pnpm build`, and local run succeed.

## Security & Configuration Tips
- Runtime: Node 20+; default port `3000` (override via `PORT`).
- SSR: Enabled by default (`react-router.config.ts`); set `ssr: false` for SPA.
- Secrets: Do not commit; inject via env vars and read server-side only.

