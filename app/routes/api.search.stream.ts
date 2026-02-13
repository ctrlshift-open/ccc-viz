/**
 * SSE endpoint for streaming search results.
 * Finite stream — closes when search completes or is cancelled.
 */

import type { SearchFilters } from "~/types/search";

export async function loader({ request }: { request: Request }) {
  const { searchSessions, getCandidateFiles } = await import(
    "~/utils/search.server"
  );

  const url = new URL(request.url);
  const filters: SearchFilters = {
    query: url.searchParams.get("q") || "",
    daysBack: url.searchParams.get("days")
      ? Number(url.searchParams.get("days"))
      : null,
    projects: url.searchParams.get("projects")
      ? url.searchParams.get("projects")!.split(",").filter(Boolean)
      : [],
    messageTypes: url.searchParams.get("types")
      ? url.searchParams.get("types")!.split(",").filter(Boolean)
      : [],
    models: url.searchParams.get("models")
      ? url.searchParams.get("models")!.split(",").filter(Boolean)
      : [],
    includeToolContent: url.searchParams.get("toolContent") === "1",
  };

  if (!filters.query.trim()) {
    return new Response(JSON.stringify({ error: "Query required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();

      const send = (event: string, data: unknown) => {
        try {
          const payload =
            `event: ${event}\n` +
            `data: ${JSON.stringify(data)}\n` +
            "\n";
          controller.enqueue(enc.encode(payload));
        } catch {
          // controller may be closed
        }
      };

      send("ready", { ok: true });

      try {
        let resultCount = 0;
        for await (const event of searchSessions(filters, request.signal)) {
          if (request.signal.aborted) break;

          if (event.type === "result") {
            resultCount++;
            send("result", event.data);
          } else if (event.type === "progress") {
            send("progress", {
              scanned: event.scanned,
              total: event.total,
            });
          }
        }

        if (resultCount >= 500) {
          send("truncated", { count: resultCount });
        }

        send("done", { count: resultCount });
      } catch (err: any) {
        if (!request.signal.aborted) {
          send("error", { message: err?.message || "Search failed" });
        }
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
