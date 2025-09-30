import type { Route } from "./+types/api.sessions.$project.$sessionId.active";

function parseThreshold(url: URL): number {
  const sec = Number(url.searchParams.get("thresholdSec") || "");
  if (Number.isFinite(sec) && sec > 0 && sec < 3600) return sec * 1000; // cap at 1h
  return 1_800_000; // default 30m
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const project = params.project!;
  const sessionId = params.sessionId!;
  const url = new URL(request.url);
  const thresholdMs = parseThreshold(url);

  try {
    const [{ resolveSessionFile }, { getExistingTailer }, { isProcessActive }] = await Promise.all([
      import("~/utils/path-safety.server"),
      import("~/utils/file-tail.server"),
      import("~/claude-cli.server"),
    ]);
    const { file } = resolveSessionFile(project, sessionId);
    const fs = await import("node:fs/promises");
    const st = await fs.stat(file).catch(() => null);
    const mtimeMs = st?.mtimeMs ?? 0;

    const tailer = getExistingTailer(project, sessionId);
    const lastAppendAt = tailer?.getLastAppendAt() ?? null;
    const subs = tailer?.getSubscriberCount() ?? 0;

    // Check if process is actively running
    const hasActiveProcess = isProcessActive(sessionId);

    // Quick heuristic: recent writes imply active
    const now = Date.now();
    const recentMs = Math.max(mtimeMs || 0, lastAppendAt || 0);
    let active = hasActiveProcess || (recentMs > 0 && (now - recentMs) <= thresholdMs);
    let reason = hasActiveProcess ? "process-running" : (active ? "recent-write" : "stale");

    // Refine by tail-of-file signal (look for explicit summary end)
    let lastEventType: string | null = null;
    let lastEventTimestamp: string | null = null;
    let hasFinalSummary = false;
    let lastEventIsStop = false;

    const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");
    const looksLikeStop = (v: any) => {
      if (!v || typeof v !== "object") return false;
      const t = (v as any).type;
      const c = (typeof (v as any).content === "string") ? (v as any).content : "";
      const norm = stripAnsi(c).toLowerCase();
      if (t === "system" && /\bstop\b/i.test(norm)) {
        // Consider both success and failure as terminal
        if (norm.includes("completed") || norm.includes("failed") || norm.includes("stop")) return true;
      }
      return false;
    };
    try {
      if (st && st.size > 0) {
        const fd = await fs.open(file, "r");
        try {
          const tailBytes = Math.min(st.size, 64 * 1024); // last 64KB
          const start = st.size - tailBytes;
          const buf = Buffer.allocUnsafe(tailBytes);
          const { bytesRead } = await fd.read(buf, 0, tailBytes, start);
          const text = buf.subarray(0, bytesRead).toString("utf8");
          const lines = text.split(/\r?\n/).filter(Boolean);
          for (let i = Math.max(0, lines.length - 50); i < lines.length; i++) {
            try {
              const v = JSON.parse(lines[i]);
              if (v && typeof v === "object") {
                lastEventType = (v as any).type ?? null;
                lastEventTimestamp = (v as any).timestamp ?? null;
                lastEventIsStop = looksLikeStop(v);
                if ((v as any).type === "summary" && !(v as any).message) hasFinalSummary = true;
              }
            } catch { /* ignore */ }
          }
          if (lastEventIsStop) {
            active = false;
            reason = "stop";
          } else if (hasFinalSummary && !active) {
            reason = "final-summary";
          }
        } finally {
          await fd.close();
        }
      }
    } catch {
      // ignore tail read
    }

    return Response.json({
      active,
      reason,
      hasActiveProcess,
      mtimeMs,
      lastAppendAt,
      thresholdMs,
      subs,
      lastEventType,
      lastEventTimestamp,
      lastEventIsStop,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
