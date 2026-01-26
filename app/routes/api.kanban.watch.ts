/**
 * SSE endpoint for session file watcher events
 * Streams events when sessions are added/changed/removed
 */

export async function loader() {
  const { subscribe } = await import("~/utils/session-watcher.server");

  let unsub: (() => void) | null = null;
  let hb: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();

      const send = (event: string, data: unknown) => {
        const payload =
          `event: ${event}\n` +
          (data !== undefined ? `data: ${JSON.stringify(data)}\n` : "") +
          "\n";
        controller.enqueue(enc.encode(payload));
      };

      // Suggest client retry delay to 2s
      controller.enqueue(enc.encode(`retry: 2000\n`));

      // Let client know stream is ready
      send("ready", { ok: true });

      // Subscribe to watcher events
      unsub = subscribe((watcherEvent) => {
        send(watcherEvent.type, watcherEvent);
      });

      // Heartbeat to keep proxies from closing the connection
      hb = setInterval(() => send("ping", Date.now()), 15000);
    },
    cancel() {
      if (hb) {
        try {
          clearInterval(hb);
        } catch {}
        hb = null;
      }
      if (unsub) {
        try {
          unsub();
        } catch {}
        unsub = null;
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
