import type { Route } from "./+types/_index";
import { Link, useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import { formatUSD, costColorHex } from "~/utils/format";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  // Import server module only in loader (server-side)
  const { getProjects } = await import("~/projects.server");
  return getProjects();
}

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const [projectCosts, setProjectCosts] = useState<Record<string, number>>({});
  const [projectScales, setProjectScales] = useState<Record<string, { greenMax: number; yellowMax: number; redMax?: number } | undefined>>({});
  const [useAdaptiveColors, setUseAdaptiveColors] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ccviz:adaptiveColors:__projects__");
      if (raw != null) setUseAdaptiveColors(raw === "true");
    } catch {}
  }, []);

  const toggleAdaptive = () => {
    setUseAdaptiveColors(prev => {
      const next = !prev;
      try { localStorage.setItem("ccviz:adaptiveColors:__projects__", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      if (!data.projects || data.projects.length === 0) return;
      const entries = await Promise.all(
        data.projects.map(async (p) => {
          try {
            const r = await fetch(`/api/sessions/costs?project=${encodeURIComponent(p.name)}`);
            if (!r.ok) return [p.name, undefined, undefined] as const;
            const json = await r.json();
            return [p.name, json.projectTotalUSD as number | undefined, json.scale as any] as const;
          } catch {
            return [p.name, undefined, undefined] as const;
          }
        })
      );
      if (cancelled) return;
      const costs: Record<string, number> = {};
      const scales: Record<string, { greenMax: number; yellowMax: number; redMax?: number } | undefined> = {};
      for (const [name, cost, scale] of entries) {
        if (typeof cost === "number") costs[name] = cost;
        scales[name] = scale;
      }
      setProjectCosts(costs);
      setProjectScales(scales);
    }
    loadAll();
    return () => { cancelled = true; };
  }, [data.projects]);

  return (
    <main className="p-4 max-w-screen-md mx-auto">
      <h1 className="text-xl font-semibold mb-2">Projects</h1>
      <p className="text-sm text-gray-500 mb-4 break-all">
        Source: {data.dir}
      </p>
      {data.error ? (
        <div className="text-red-600">{data.error}</div>
      ) : data.projects.length === 0 ? (
        <div className="text-gray-600">No projects found.</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="mb-3 text-sm text-gray-400">
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={useAdaptiveColors} onChange={toggleAdaptive} />
              <span>Adaptive colors</span>
            </label>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="py-2 pr-4">Project</th>
                <th className="py-2 pr-4">Last Modified</th>
                <th className="py-2">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr key={p.name} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-medium">
                    <Link to={`/${encodeURIComponent(p.name)}/sessions`} className="text-blue-600 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{p.modified}</td>
                  <td className="py-2 whitespace-nowrap">
                    <span style={{ color: costColorHex(projectCosts[p.name] as number | undefined, useAdaptiveColors ? projectScales[p.name] : undefined) }}>
                      {formatUSD(projectCosts[p.name] as number | undefined)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
