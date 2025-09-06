import type { Route } from "./+types/api.sessions.$project.$sessionId.totals";

export async function loader({ params }: Route.LoaderArgs) {
  const project = params.project!;
  const sessionId = params.sessionId!;
  try {
    const { resolveSessionFile } = await import("~/utils/path-safety.server");
    const { file } = resolveSessionFile(project, sessionId);
    const { readFile } = await import("node:fs/promises");

    const content = await readFile(file, "utf8");
    const allLines = content.split(/\r?\n/).filter((l) => l.length > 0);
    const totalLines = allLines.length;

    // Categories
    type Cat = { key: string; label: string; count: number };
    const prefOrder = [
      "assistant|message",
      "assistant|thinking",
      "assistant|tool_use|TodoWrite",
      "assistant|tool_use",
      "user|message",
      "user|tool_result",
      "summary",
      "invalid",
    ];
    const catMap = new Map<string, string>();
    const catCount = new Map<string, number>();
    const addCat = (key: string, label: string) => {
      if (!catMap.has(key)) {
        catMap.set(key, label);
        catCount.set(key, 0);
      }
      catCount.set(key, (catCount.get(key) || 0) + 1);
    };
    const classify = (v: any) => {
      const top: string = (v?.type as string) || "unknown";
      if (top === "summary" && !v?.message) {
        addCat("summary", "summary");
        return;
      }
      const c = v?.message?.content;
      const segs: any[] = Array.isArray(c) ? c : c ? [c] : [];
      {
        const tu = segs.find((s) => s && s.type === "tool_use");
        if (tu) {
          const name = tu.name;
          if (name === "TodoWrite") addCat(`${top}|tool_use|TodoWrite`, `TodoWrite`);
          else addCat(`${top}|tool_use`, `tool use`);
          return;
        }
      }
      if (segs.find((s) => s && s.type === "tool_result")) {
        addCat(`${top}|tool_result`, `tool result`);
        return;
      }
      if (segs.find((s) => s && s.type === "thinking")) {
        addCat(`${top}|thinking`, `thinking`);
        return;
      }
      if (segs.find((s) => typeof s === "string" || (s && s.type === "text"))) {
        addCat(`${top}|message`, `${top}`);
        return;
      }
      addCat(`${top}|entry`, `${top}`);
    };
    for (const line of allLines) {
      try {
        const v = JSON.parse(line);
        classify(v);
      } catch {
        addCat("invalid", "invalid");
      }
    }
    const categories = Array.from(catMap.entries()).map(([key, label]) => ({
      key,
      label,
      count: catCount.get(key) || 0
    })) as Cat[];
    categories.sort((a, b) => {
      const ia = prefOrder.indexOf(a.key);
      const ib = prefOrder.indexOf(b.key);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.label.localeCompare(b.label);
    });

    // Totals + dynamic message cost scale
    let totals: {
      totalUSD: number;
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens: number;
      cacheReadTokens: number;
    } | undefined;
    let messageCostScale: { greenMax: number; yellowMax: number; redMax?: number } | undefined;
    try {
      const [{ PricingFetcher }, { calculateCostForEntry }] = await Promise.all([
        import("ccusage/pricing-fetcher"),
        import("ccusage/data-loader"),
      ]);
      const fetcher = new PricingFetcher(true);
      let totalUSD = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheCreationTokens = 0;
      let cacheReadTokens = 0;
      const allMessageCosts: number[] = [];
      for (const line of allLines) {
        try {
          const v = JSON.parse(line);
          try {
            const cost = await calculateCostForEntry(v, "auto", fetcher);
            if (typeof cost === "number" && Number.isFinite(cost)) {
              totalUSD += cost;
              if (cost > 0) allMessageCosts.push(cost);
            }
          } catch {}
          const u = (v?.message?.usage ?? {}) as any;
          if (typeof u.input_tokens === "number") inputTokens += u.input_tokens;
          if (typeof u.output_tokens === "number") outputTokens += u.output_tokens;
          if (typeof u.cache_creation_input_tokens === "number") cacheCreationTokens += u.cache_creation_input_tokens;
          if (typeof u.cache_read_input_tokens === "number") cacheReadTokens += u.cache_read_input_tokens;
        } catch {}
      }
      totals = { totalUSD, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens };
      if (allMessageCosts.length > 0) {
        allMessageCosts.sort((a, b) => a - b);
        const p = (q: number) => {
          if (allMessageCosts.length === 1) return allMessageCosts[0];
          const idx = Math.floor(q * (allMessageCosts.length - 1));
          return allMessageCosts[idx];
        };
        let p50 = p(0.5);
        let p90 = p(0.9);
        if (p90 < p50) [p50, p90] = [p90, p50];
        if (p90 === p50) p90 = p50 * 1.5 || 1.0;
        const max = allMessageCosts[allMessageCosts.length - 1] ?? p90;
        const redMax = Math.max(p90 + 1e-9, max);
        messageCostScale = { greenMax: p50, yellowMax: p90, redMax };
      }
    } catch {
      // continue without totals if ccusage not available
    }

    return Response.json({ totalLines, categories, totals, messageCostScale });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

