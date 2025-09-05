import type { Route } from "./+types/$project.sessions._index";
import { Link, useLoaderData } from "react-router";
// Note: server-only Node imports are loaded dynamically inside the loader
import { useEffect, useState } from "react";
import { formatUSD, costColorHex } from "~/utils/format";


type Session = { id: string; filename: string; modified: string };
type SessionPreview = {
  id: string;
  firstMessage: string;
  totalMessages: number;
  gitBranch?: string;
  timestamp: string;
};

export async function loader({ params }: Route.LoaderArgs) {
  const project = params.project!;
  const [ps, pathMod, fs] = await Promise.all([
    import("~/utils/path-safety.server"),
    import("node:path"),
    import("node:fs/promises"),
  ]);
  const { base: baseDir, dir } = ps.resolveProjectDir(project);

  try {
    // Read directory entries and collect .jsonl files with mtime
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const temp: Array<{ mtimeMs: number; session: Session }> = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".jsonl")) continue;
      const id = entry.name.replace(/\.jsonl$/i, "");
      try {
        const st = await fs.stat(pathMod.join(dir, entry.name));
        const d = st.mtime;
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = months[d.getMonth()];
        const day = d.getDate();
        const hours = d.getHours().toString().padStart(2, "0");
        const minutes = d.getMinutes().toString().padStart(2, "0");
        const currentYear = new Date().getFullYear();
        const timeYear = d.getFullYear() === currentYear ? `${hours}:${minutes}` : String(d.getFullYear());
        temp.push({ mtimeMs: d.getTime(), session: { id, filename: entry.name, modified: `${month} ${day} ${timeYear}` } });
      } catch {
        // ignore stat errors
      }
    }
    const sessions = temp.sort((a, b) => b.mtimeMs - a.mtimeMs).map((t) => t.session);

    // Costs are lazy-loaded client-side via /api/sessions/costs
    return { baseDir, project, dir, sessions };
  } catch (error) {
    return {
      baseDir,
      project,
      dir,
      sessions: [],
      error: `Failed to read sessions: ${(error as Error).message}`,
    };
  }
}

// Skeleton loader component
function SessionSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
      <div className="flex gap-4 text-xs">
        <div className="h-3 bg-gray-700 rounded w-20"></div>
        <div className="h-3 bg-gray-700 rounded w-16"></div>
        <div className="h-3 bg-gray-700 rounded w-24"></div>
      </div>
    </div>
  );
}

export default function ProjectSessions() {
  const data = useLoaderData<typeof loader>();
  const [previews, setPreviews] = useState<Record<string, SessionPreview | null>>({});
  const [loading, setLoading] = useState(true);
  const [sessionCosts, setSessionCosts] = useState<Record<string, number>>({});
  const [projectTotalUSD, setProjectTotalUSD] = useState<number | null>(null);
  const [sessionScale, setSessionScale] = useState<{ greenMax: number; yellowMax: number; redMax?: number } | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [useAdaptiveColors, setUseAdaptiveColors] = useState(true);

  useEffect(() => {
    if (data.sessions.length === 0) return;

    // Check localStorage for cached previews
    const cached: Record<string, SessionPreview | null> = {};
    const toFetch: string[] = [];

    data.sessions.forEach(session => {
      const cacheKey = `session-preview-v2:${data.project}:${session.id}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          // Check if cache is less than 24 hours old
          if (parsed.cachedAt && Date.now() - parsed.cachedAt < 24 * 60 * 60 * 1000) {
            cached[session.id] = parsed.preview;
          } else {
            toFetch.push(session.id);
            localStorage.removeItem(cacheKey); // Clean up expired cache
          }
        } catch {
          toFetch.push(session.id);
        }
      } else {
        toFetch.push(session.id);
      }
    });

    // Set cached previews immediately
    if (Object.keys(cached).length > 0) {
      setPreviews(cached);
    }

    // Fetch missing previews
    if (toFetch.length > 0) {
      fetch(`/api/sessions/previews?project=${encodeURIComponent(data.project)}&ids=${toFetch.join(",")}`)
        .then(res => res.json())
        .then(fetchedPreviews => {
          // Cache the fetched previews
          Object.entries(fetchedPreviews).forEach(([id, preview]) => {
            if (preview) {
              const cacheKey = `session-preview-v2:${data.project}:${id}`;
              localStorage.setItem(cacheKey, JSON.stringify({
                preview,
                cachedAt: Date.now()
              }));
            }
          });

          setPreviews(prev => ({ ...prev, ...fetchedPreviews }));
        })
        .catch(error => {
          console.error("Failed to fetch session previews:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [data.sessions, data.project]);

  // Lazy-load costs (project total + per-session)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/costs?project=${encodeURIComponent(data.project)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((res: { projectTotalUSD?: number; sessionCosts?: Record<string, number>; scale?: { greenMax: number; yellowMax: number; redMax?: number } | null }) => {
        if (cancelled) return;
        if (typeof res.projectTotalUSD === "number") setProjectTotalUSD(res.projectTotalUSD);
        if (res.sessionCosts && typeof res.sessionCosts === "object") setSessionCosts(res.sessionCosts);
        if (res.scale && typeof res.scale.greenMax === "number" && typeof res.scale.yellowMax === "number") setSessionScale(res.scale);
      })
      .catch(() => { /* silent */ })
      .finally(() => { /* no-op */ });
    return () => { cancelled = true; };
  }, [data.project]);

  // Load persisted adaptive color preference per project
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`ccviz:adaptiveColors:${data.project}`);
      if (raw != null) setUseAdaptiveColors(raw === "true");
    } catch {}
  }, [data.project]);

  const toggleAdaptive = () => {
    setUseAdaptiveColors((prev) => {
      const next = !prev;
      try { localStorage.setItem(`ccviz:adaptiveColors:${data.project}`, String(next)); } catch {}
      return next;
    });
  };

  const scaleUsed = useAdaptiveColors ? sessionScale ?? undefined : undefined;

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold mb-2">Sessions</h1>
      <p className="text-sm text-gray-500 mb-4 break-all">
        Project: <strong>{data.project}</strong>
      </p>
      <div className="mb-3 text-sm text-gray-400 flex flex-wrap items-center gap-3">
        <span>
          Project total cost: <strong style={{ color: costColorHex(projectTotalUSD as number | null | undefined, scaleUsed) }}>{formatUSD(projectTotalUSD)}</strong>
        </span>
        <button type="button" className="text-blue-500 hover:underline" onClick={() => setShowLegend((s) => !s)}>
          {showLegend ? "Hide legend" : "Show legend"}
        </button>
        <label className="inline-flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={useAdaptiveColors} onChange={toggleAdaptive} />
          <span>Adaptive colors</span>
        </label>
      </div>
      {showLegend ? (
        <div className="mb-3 text-xs text-gray-300 border border-gray-700 bg-gray-900 rounded p-2">
          {scaleUsed ? (
            <div>
              <div>Green ≤ {formatUSD(scaleUsed.greenMax)}</div>
              <div>Yellow ≤ {formatUSD(scaleUsed.yellowMax)}</div>
              <div>Red up to {formatUSD((scaleUsed.redMax ?? (scaleUsed.yellowMax * 4)) as number)}</div>
            </div>
          ) : (
            <div>
              <div>Green &lt; $0.50</div>
              <div>Yellow $0.50–$0.99</div>
              <div>Red ≥ $1.00</div>
            </div>
          )}
        </div>
      ) : null}
      <div className="mb-4">
        <Link to="/" className="text-blue-600 hover:underline">← Back to projects</Link>
      </div>

      {data.error ? (
        <div className="text-red-600">{data.error}</div>
      ) : data.sessions.length === 0 ? (
        <div className="text-gray-600">No sessions found.</div>
      ) : (
        <div className="space-y-3">
          {data.sessions.map((s) => {
            const preview = previews[s.id];
            const isLoading = loading && !preview;

            return (
              <Link
                key={s.filename}
                to={`/${encodeURIComponent(data.project)}/sessions/${encodeURIComponent(s.id)}?view=condensed`}
                className="block p-4 border border-gray-600 rounded-lg hover:border-blue-500 hover:bg-gray-800 transition-colors"
              >
                {isLoading ? (
                  <SessionSkeleton />
                ) : preview ? (
                  <div>
                    <div className="font-medium text-gray-100 mb-2 line-clamp-2">
                      {preview.firstMessage}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                      <span>{s.modified}</span>
                      {preview.gitBranch && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
                          </svg>
                          {preview.gitBranch}
                        </span>
                      )}
                      <span>{preview.totalMessages} 💬</span>
                      <span style={{ color: costColorHex(sessionCosts[s.id] as number | undefined, scaleUsed) }}>{formatUSD(sessionCosts[s.id] as number | undefined)}</span>
                      <span className="text-[10px] text-gray-500">{s.id}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium text-gray-100 mb-2">
                      {s.id}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                      <span>{s.modified}</span>
                      <span style={{ color: costColorHex(sessionCosts[s.id] as number | undefined, scaleUsed) }}>{formatUSD(sessionCosts[s.id] as number | undefined)}</span>
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
