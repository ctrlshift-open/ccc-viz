# Cost Calculation with ccusage

## Overview

We integrate the ccusage npm package to compute token costs for Claude Code JSONL logs found under ~/.claude/projects/<project>/<sessionId>.jsonl. Costs appear at three levels:

- Per-message (inside a session)
- Per-session (on the project sessions list)
- Per-project (on the projects index)

## Data Flow

- Source files: .jsonl lines parsed server-side.
- Cost engine: ccusage calculateCostForEntry(data, 'auto', fetcher).
- Pricing: PricingFetcher(true) uses an offline pricing table (stable, no network). Set false to fetch latest pricing (LiteLLM JSON).

## Where Calculations Happen

- Session details (app/routes/$project.sessions.$sessionId.tsx):
  - Loader reads the session file, computes per-line costs (attaches costUSD), and aggregates total tokens and USD.
  - Also computes a per-session cost scale (P50, P90, red cap = max) for adaptive coloring.
- Project sessions list (app/routes/$project.sessions.\_index.tsx):
  - Loader lists sessions only; costs are lazy-loaded from the API.
- Projects index (app/routes/\_index.tsx):
  - Per-project totals are lazy-loaded (one API call per project).

## API

- GET /api/sessions/costs?project=<name> (app/routes/api.sessions.costs.ts)
  - Returns: { projectTotalUSD, sessionCosts: Record<sessionId, number>, scale?: { greenMax, yellowMax, redMax } }
  - Implementation: reads all session files for the project and sums calculateCostForEntry(...).

## Display & Formatting

- Currency: formatUSD($) → "$X,XXX.XX" (or "—" when missing).
- Coloring:
  - Gradient: ["#00ff00","#40ff00","#80ff00","#bfff00","#ffff00","#ffff00","#ffff00","#ffbf00","#ff8000","#ff4000","#ff0000"].
  - Adaptive thresholds: P50 (greenMax), P90 (yellowMax), redMax (≈P99/max). Tight ranges are widened slightly.
  - Mapping function: costColorHex(amount, scale?) picks a discrete stop across green→yellow→red.
  - Toggle “Adaptive colors”: user can switch to fixed thresholds (green < $0.50, yellow $0.50–$0.99, red ≥ $1.00). Preference persists per-project in localStorage.

## Notes

- “Auto” mode in ccusage uses costUSD if present; otherwise computes from message.usage and message.model.
- Missing model or usage yields zero cost (explicitly surfaced as “—” in UI until loaded).
- A small Vitest suite validates formatUSD.
