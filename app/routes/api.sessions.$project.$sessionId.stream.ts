import type { Route } from "./+types/api.sessions.$project.$sessionId.stream";

// Server-sent events stream of appended JSONL lines for a given session file
export async function loader({ request, params }: Route.LoaderArgs) {
  const project = params.project!;
  const sessionId = params.sessionId!;

  const url = new URL(request.url);
  const fromLine = url.searchParams.get("fromLine");
  const dir = (url.searchParams.get("dir") as "asc" | "desc" | null) || null;

  const { getOrCreateTailer } = await import("~/utils/file-tail.server");
  const tailer = await getOrCreateTailer(project, sessionId, fromLine ? Number(fromLine) : undefined);

  let unsub: (() => void) | null = null;
  let hb: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();

      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\n` +
          (data !== undefined ? `data: ${JSON.stringify(data)}\n` : "") +
          "\n";
        controller.enqueue(enc.encode(payload));
      };

      // Suggest client retry delay to 2s
      controller.enqueue(enc.encode(`retry: 2000\n`));

      // Let client know stream is ready
      send("ready", { ok: true });

      // Subscribe to file tail updates
      unsub = tailer.subscribe((batch) => {
        // Order new items: server sends as appended lines; client decides where to place based on dir
        send("append", { items: batch });
      });

      // Heartbeat to keep proxies from closing the connection
      hb = setInterval(() => send("ping", Date.now()), 15000);
    },
    cancel() {
      if (hb) { try { clearInterval(hb); } catch {} hb = null; }
      if (unsub) { try { unsub(); } catch {} unsub = null; }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // Allow immediate retry on disconnect
      "X-Accel-Buffering": "no",
    },
  });
}
