# cc-viz

Visualize and explore your local Claude Code sessions from `~/.claude/projects/*`. cc-viz is a full‑stack React Router app that lists projects, summarizes sessions, and estimates token costs—entirely offline.

## Features

- SSR React Router app with Tailwind v4 styling
- Reads JSONL session logs from `~/.claude/projects/<project>/*.jsonl`
- Project/session views with previews, filters, and cost estimates (via `ccusage` with offline pricing)
- TypeScript, strict types; React 19; Vite dev server with HMR

## Requirements

- Node 20+
- PNPM (enable via `corepack enable`)

## Getting Started

```bash
pnpm install
pnpm dev
```

Dev server runs at `http://localhost:5174` by default. Configure via env:

- `VITE_DEV_HOST` (default: `localhost`)
- `VITE_DEV_PORT` (default: `5174`)
- `VITE_ALLOWED_HOSTS` (comma-separated; default: `localhost`)

Important: This app reads files from your local machine. It’s intended for local use. Do not expose the dev server on untrusted networks without adding authentication.

## Usage (npx)

Run the prebuilt app without installing or building locally:

```bash
npx cc-viz@latest
```

Environment overrides:

- `PORT`: server port (e.g., `PORT=3000 npx cc-viz@latest`)
- `HOST`: bind address (e.g., `HOST=0.0.0.0` to listen on all interfaces)

The server logs the URL on startup. Data is read from `~/.claude/projects` by default.

### Test Locally Without Publishing

Create a tarball and run it with npx:

```bash
npm pack
# Replace version with the one printed by npm pack
npx -y -p ./cc-viz-0.1.0.tgz cc-viz
```

Alternatively, extract and run directly:

```bash
npm pack
mkdir -p tmp/pkg && tar -xf cc-viz-0.1.0.tgz -C tmp/pkg
PORT=3000 node tmp/pkg/package/bin/cc-viz.js
```

## Scripts

- `pnpm typecheck` – generate route types + TypeScript checks
- `pnpm test` – run Vitest
- `pnpm build` – build client and server to `build/`
- `pnpm start` – serve production build (`react-router-serve ./build/server/index.js`)

## Docker

Build and run:

```bash
docker build -t cc-viz .
docker run -p 3000:3000 -v $HOME/.claude/projects:/root/.claude/projects:ro cc-viz
```

The container serves on port `3000`. Mount your Claude projects directory read‑only if you want to view your data in the container.

## Project Structure

- `app/` – source code (routes in `app/routes/`, UI in `app/welcome/`)
- `public/` – static assets served at `/`
- `react-router.config.ts` – SSR config
- `vite.config.ts` – dev server/plugins (hosts configurable via env)
- `tsconfig.json` – path alias `~/* -> app/*`

## Security & Privacy

- Loaders validate route params and constrain all file access to `~/.claude/projects`.
- No network calls are made for pricing; costs use `ccusage` offline data.
- Please avoid running this on public networks without auth; see `.github/SECURITY.md`.

## Contributing

See `.github/CONTRIBUTING.md` and `.github/CODE_OF_CONDUCT.md`.

## License

MIT – see `LICENSE`.
