import type { Route } from "./+types/api.sessions.costs";
import { homedir } from "node:os";
import * as path from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolveProjectDir } from "~/utils/path-safety.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const project = url.searchParams.get("project");
  if (!project) {
    return Response.json({ error: "Missing project parameter" }, { status: 400 });
  }

  try {
    const { base: baseDir, dir: projectDir } = resolveProjectDir(project);

    // Verify directory exists
    try {
      const st = await stat(projectDir);
      if (!st.isDirectory()) throw new Error("Not a directory");
    } catch {
      return Response.json({ projectTotalUSD: 0, sessionCosts: {} });
    }

    const files = await readdir(projectDir);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

    const [{ PricingFetcher }, { calculateCostForEntry }] = await Promise.all([
      import("ccusage/pricing-fetcher"),
      import("ccusage/data-loader"),
    ]);
    const fetcher = new PricingFetcher(true); // offline pricing

    const sessionCosts: Record<string, number> = {};
    let projectTotalUSD = 0;

    for (const file of jsonlFiles) {
      const sessionId = file.replace(/\.jsonl$/i, "");
      const filePath = path.join(projectDir, file);
      let total = 0;
      let lastModel: string | undefined;
      try {
        const content = await readFile(filePath, "utf8");
        const lines = content.split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          try {
            const v = JSON.parse(line);
            // Use ccusage's calculation for consistency with detail view
            const cost = await calculateCostForEntry(v, "auto", fetcher);
            if (typeof cost === "number" && Number.isFinite(cost)) total += cost;
            // Track last seen model for potential heuristics (not currently needed)
            if (typeof v?.message?.model === "string") lastModel = v.message.model;
          } catch {
            // ignore invalid lines
          }
        }
      } catch {
        // ignore file read errors per session
      }
      sessionCosts[sessionId] = total;
      projectTotalUSD += total;
    }

    // Compute dynamic scale based on session costs (ignore zeros)
    const values = Object.values(sessionCosts).filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
    const scale = computeScale(values);

    return Response.json({ projectTotalUSD, sessionCosts, scale });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

function computeScale(values: number[]): { greenMax: number; yellowMax: number; redMax: number } | null {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const p = (q: number) => {
    if (sorted.length === 1) return sorted[0];
    const idx = Math.floor(q * (sorted.length - 1));
    return sorted[idx];
  };
  let p50 = p(0.5);
  let p90 = p(0.9);
  if (p90 < p50) [p50, p90] = [p90, p50];
  if (p90 === p50) p90 = p50 * 1.5 || 1.0; // avoid equal thresholds
  const p99 = p(0.99);
  const max = sorted[sorted.length - 1] ?? p99;
  let redMax = Math.max(p90 + 1e-9, p99, max);
  if (redMax === p90) redMax = p90 * 1.5 || 1.0;
  return { greenMax: p50, yellowMax: p90, redMax };
}
