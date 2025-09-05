# cc-viz Open Source Readiness Review

Date: 2025-09-04

## Executive Summary

Overall, the repository is in good shape for open source. No hard-coded secrets or API keys were found.

Status update: the items identified below have been addressed in this pass and the repo is ready to go public.

- Security: Path traversal risks removed and OS command usage replaced.
- Privacy: Internal hosts/paths sanitized; local helper removed.
- Hygiene: Added `LICENSE`, `.github` community files, CI, and aligned Docker/README.

---

## What This App Does (for context)

- Full‑stack React Router app that visualizes local Claude Code sessions stored under `~/.claude/projects/<project>/*.jsonl`.
- SSR loaders/APIs read from the filesystem to list projects, sessions, and compute costs using `ccusage` (offline pricing fetcher).
- Intended primarily for local use; can be run via Node or Docker.

---

## Findings

### 1) Security Risks

- Path traversal in file access (resolved)
  - Implemented strict validation and base-path containment checks.
  - Centralized helpers in `app/utils/path-safety.server.ts`.
  - Hardened files: `app/routes/$project.sessions._index.tsx`, `app/routes/api.sessions.costs.ts`, `app/routes/$project.sessions.$sessionId.tsx`, and `app/sessions.server.ts`.

- OS command usage for directory listing (resolved)
  - Replaced `execFile('/bin/ls', ...)` with `fs.readdir` + `fs.stat`.

- Unauthenticated access to local data
  - Documented local-use caution in README. For public deployments, add auth before exposing.

- Markdown/HTML rendering (Low)
  - `react-markdown` is used with default escaping, which is safe by default. Keep it that way (avoid enabling raw HTML plugins). Links use `rel="noreferrer"` which mitigates `window.opener`; consider also `noopener`.

### 2) Privacy/PII and Internal Details in Repo

- Sanitized `vite.config.ts` to read hosts from env; removed internal hosts/IPs.
- Removed `tmux-urls.cfg` and added to `.gitignore`.
- Updated `docs/session-message-types.md` to use generic `~/.claude/projects/<project>` path.

- ### 3) Licensing and Compliance

- Added `LICENSE` (MIT). `package.json` remains private; no npm publish intended.
- Direct dependency licenses (spot check):
  - `react`, `react-dom`, `react-router`, `@react-router/*`, `tailwindcss`, `vite`, `vitest`, `ccusage`, `ansi_up`: MIT
  - `lucide-react`: ISC
  - `isbot`: Unlicense
  - `typescript`: Apache-2.0
  - Some dev plugins didn’t resolve during quick scan; they’re typically MIT. Do a final pass with a license checker before release if needed.

### 4) Docker/Tooling/Docs

- Rewrote Dockerfile to use PNPM and `pnpm prune --prod` for a small runtime image.
- Replaced template README with app-specific docs, correct dev port (5174), and a local-use notice.
- Added CI workflow running typecheck, build, and tests on pushes/PRs.

---

## Recommendations (Fixes to Apply)

### A) Harden file access and remove OS command

Implemented in `app/utils/path-safety.server.ts` and applied across loaders.

### B) Limit exposure surface (especially for non-local use)

- Dev server now reads `VITE_DEV_HOST`, `VITE_DEV_PORT`, and `VITE_ALLOWED_HOSTS` from env.
- README documents local-only intent and cautions for public exposure.

### C) Sanitize repo content

- Removed `tmux-urls.cfg`, added to `.gitignore`.
- Generalized personal paths in docs.

### D) Add open-source essentials

Added `LICENSE`, `.github/CODE_OF_CONDUCT.md`, `.github/CONTRIBUTING.md`, `.github/SECURITY.md`, issue/PR templates, and updated README.

### E) Build/test consistency

- Docker standardized on PNPM with frozen lockfile.
- CI runs typecheck, build, and tests.

---

## Commit History Review (high-level)

- No secrets detected in history. Notable items:
  - Initially used hard-coded home path; later refactored to dynamic (`homedir()`); good.
  - Added Tailnet/host info (`vite.config.ts`) and local helper (`tmux-urls.cfg`)—should be sanitized before release.
  - Evolution shows app moved from basic listing to detailed session views with costs/filters.
- Remotes:
  - `origin` and `public` GitHub remotes are configured. Ensure push targets and default branch are correct before making the repo public.

If you wish to fully scrub personal file references from history, you can rewrite history (e.g., `git filter-repo`) to remove `tmux-urls.cfg` and sanitize docs, but this is optional since no secrets are present.

---

## Dependency Inventory (direct)

- Runtime deps: `@react-router/*`, `react`, `react-dom`, `react-router`, `react-markdown`, `ccusage`, `lucide-react`, `isbot`, `ansi_up`.
- Dev deps: `@react-router/dev`, `tailwindcss`, `@tailwindcss/vite`, `vite`, `vitest`, `typescript`, `vite-tsconfig-paths`, `@types/*`.
- Spot check licenses: mostly MIT/ISC/Apache-2.0/Unlicense. Run a license audit in CI for ongoing assurance.

---

## Release Plan (Suggested Checklist)

1) Security hardening
- [x] Validate `project` and `sessionId`; enforce base path containment via `path.resolve`
- [x] Replace `/bin/ls` usage with `fs.readdir`/`fs.stat`
- [x] Keep `react-markdown` safe defaults; avoid raw HTML plugins

2) Privacy and config hygiene
- [x] Remove `tmux-urls.cfg` from repo; add to `.gitignore`
- [x] Remove internal hosts/IPs from `vite.config.ts` or guard behind env
- [x] Generalize paths in docs to avoid personal usernames/domains

3) OSS essentials
- [x] Add `LICENSE` (MIT)
- [x] Add `.github/` with `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- [x] Update `README.md` with accurate ports, local-use notice, and privacy notes

4) Build/test/CI
- [x] Align Dockerfile with PNPM
- [x] Add CI: typecheck, build, and test jobs
- [ ] Optionally add a license audit job

---

## Optional Enhancements

- Add a minimal settings page to point at a custom sessions directory (defaulting to `~/.claude/projects`).
- Add a “demo mode” with sample data so the repo can run without local Claude logs.
- Provide a read-only SPA build (SSR disabled) that shows demo data—safer for public hosting.

---

## Appendix: Specific Files to Adjust

- `app/routes/$project.sessions._index.tsx`
  - Replace `execFile('/bin/ls', ...)` with Node `fs` APIs
  - Validate `params.project` and enforce base path boundaries

- `app/routes/api.sessions.costs.ts`
  - Validate `project` query; resolve path and verify it stays under base

- `app/routes/$project.sessions.$sessionId.tsx`
  - Validate `params.project` and `params.sessionId`; construct `file` via `path.resolve` and boundary-check

- `vite.config.ts`
  - Remove internal hosts/IPs; optionally configure via env

- `docs/session-message-types.md`
  - Replace absolute personal path with `~/.claude/projects/<project>/*.jsonl`

- `tmux-urls.cfg`
  - Remove and ignore

---

All critical OSS readiness items are now implemented in-tree. If you’d like, we can add a license audit step in CI as a follow-up.
