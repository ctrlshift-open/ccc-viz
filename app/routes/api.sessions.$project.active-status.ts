import type { Route } from "./+types/api.sessions.$project.active-status";

function stripAnsi(s: string) {
  return s.replace(/\u001b\[[0-9;]*m/g, "");
}

function looksLikeStop(v: any): boolean {
  if (!v || typeof v !== "object") return false;
  const t = (v as any).type;
  const c = typeof (v as any).content === "string" ? (v as any).content : "";
  const norm = stripAnsi(c).toLowerCase();
  if (t === "system" && /\bstop\b/i.test(norm)) {
    if (norm.includes("completed") || norm.includes("failed") || norm.includes("stop")) return true;
  }
  return false;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const project = params.project!;
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return Response.json({ error: "Missing ids parameter" }, { status: 400 });
  }

  try {
    const { resolveSessionFile } = await import("~/utils/path-safety.server");
    const fs = await import("node:fs/promises");
    const out: Record<string, { stopped: boolean; lastEventTimestamp: string | null }> = {};

    await Promise.all(
      ids.map(async (sessionId) => {
        try {
          const { file } = resolveSessionFile(project, sessionId);
          const st = await fs.stat(file).catch(() => null);
          if (!st || st.size <= 0) {
            out[sessionId] = { stopped: false, lastEventTimestamp: null };
            return;
          }
          const fd = await fs.open(file, "r");
          try {
            const tailBytes = Math.min(st.size, 64 * 1024);
            const start = st.size - tailBytes;
            const buf = Buffer.allocUnsafe(tailBytes);
            const { bytesRead } = await fd.read(buf, 0, tailBytes, start);
            const text = buf.subarray(0, bytesRead).toString("utf8");
            const lines = text.split(/\r?\n/).filter(Boolean);
            let stopped = false;
            let ts: string | null = null;
            for (let i = lines.length - 1; i >= 0; i--) {
              try {
                const v = JSON.parse(lines[i]);
                if (v && typeof v === "object") {
                  if (ts == null && typeof (v as any).timestamp === "string") ts = (v as any).timestamp;
                  // The last valid JSON from end is the last event; determine stopped from it and break
                  stopped = looksLikeStop(v);
                  break;
                }
              } catch {
                // keep scanning backwards
              }
            }
            out[sessionId] = { stopped, lastEventTimestamp: ts };
          } finally {
            await fd.close();
          }
        } catch {
          out[sessionId] = { stopped: false, lastEventTimestamp: null };
        }
      })
    );

    return Response.json(out);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

