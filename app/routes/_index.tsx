import type { Route } from "./+types/_index";
import { Form, Link, redirect, useLoaderData, useNavigation } from "react-router";
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

export async function action({ request }: Route.ActionArgs) {
  try {
    const formData = await request.formData();
    const projectEncoded = formData.get("project");
    const prompt = formData.get("prompt");

    if (!projectEncoded || typeof projectEncoded !== "string") {
      return { success: false, error: "Project is required" };
    }

    const initialPrompt = typeof prompt === "string" && prompt.trim()
      ? prompt.trim()
      : undefined;

    console.log("[action] Creating new session for project:", projectEncoded);
    console.log("[action] Initial prompt:", initialPrompt ? `"${initialPrompt.substring(0, 50)}..."` : "none");

    // Get working directory by reading from an existing session file
    const { readdir, readFile } = await import("node:fs/promises");
    const { homedir } = await import("node:os");
    const { join } = await import("node:path");

    const projectDir = join(homedir(), ".claude", "projects", projectEncoded);
    console.log("[action] Looking for sessions in:", projectDir);

    let workingDirectory: string | undefined;

    try {
      const files = await readdir(projectDir);
      console.log("[action] Found", files.length, "files in project directory");
      const sessionFiles = files.filter(f => f.endsWith('.jsonl'));
      console.log("[action] Found", sessionFiles.length, "session files");

      // Try each session file until we find one with a cwd
      for (const sessionFile of sessionFiles) {
        const filePath = join(projectDir, sessionFile);
        try {
          const content = await readFile(filePath, "utf8");
          const lines = content.split("\n").filter(l => l.trim());

          // Scan first 20 lines to find one with cwd
          for (let i = 0; i < Math.min(20, lines.length); i++) {
            try {
              const parsed = JSON.parse(lines[i]);
              if (parsed.cwd && typeof parsed.cwd === "string") {
                workingDirectory = parsed.cwd;
                console.log("[action] Found cwd in", sessionFile, "line", i + 1, ":", workingDirectory);
                break;
              }
            } catch {}
          }

          if (workingDirectory) break; // Found it, stop searching
        } catch (err) {
          console.log("[action] Skipping file", sessionFile, "due to error:", err);
        }
      }

      if (!sessionFiles.length) {
        console.error("[action] No .jsonl files found in directory");
      }
    } catch (err) {
      console.error("[action] Failed to read project directory:", err);
    }

    if (!workingDirectory) {
      console.error("[action] No working directory found after scanning");
      return { success: false, error: "Could not determine working directory from existing sessions" };
    }

    console.log("[action] Working directory:", workingDirectory);

    const { startNewSession } = await import("~/claude-cli.server");
    const result = await startNewSession(workingDirectory, initialPrompt);

    if (result.success && result.sessionId) {
      console.log("[action] Session created successfully:", result.sessionId);
      return redirect(`/${encodeURIComponent(projectEncoded)}/sessions/${result.sessionId}`);
    }

    console.error("[action] Failed to create session:", result.error);
    return { success: false, error: result.error || "Failed to create session" };
  } catch (err) {
    console.error("[action] Unexpected error in action:", err);
    return { success: false, error: `Unexpected error: ${err}` };
  }
}

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [projectCosts, setProjectCosts] = useState<Record<string, number>>({});
  const [projectScales, setProjectScales] = useState<Record<string, { greenMax: number; yellowMax: number; redMax?: number } | undefined>>({});
  const [useAdaptiveColors, setUseAdaptiveColors] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newSessionProject, setNewSessionProject] = useState<string | null>(null);
  const [newSessionPrompt, setNewSessionPrompt] = useState("");

  const isCreatingSession = navigation.state === "submitting";

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

  // Fuzzy search function
  const fuzzyMatch = (query: string, text: string): boolean => {
    if (!query) return true;
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    
    // Check if all characters from query appear in text in order
    let queryIndex = 0;
    for (let i = 0; i < t.length && queryIndex < q.length; i++) {
      if (t[i] === q[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === q.length;
  };

  // Filter projects based on search query
  const filteredProjects = data.projects?.filter(p => 
    fuzzyMatch(searchQuery, p.name)
  ) || [];

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
    <main className="p-4 pt-16 md:pt-14 max-w-screen-md mx-auto">
      <h1 className="text-xl font-semibold mb-2">Projects</h1>
      <p className="text-sm text-gray-500 mb-4 break-all">
        Source: {data.dir}
      </p>
      
      {/* Search input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search projects (fuzzy match)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searchQuery && (
          <p className="text-sm text-gray-500 mt-1">
            Showing {filteredProjects.length} of {data.projects?.length || 0} projects
          </p>
        )}
      </div>

      {data.error ? (
        <div className="text-red-600">{data.error}</div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-gray-600">
          {searchQuery ? `No projects matching "${searchQuery}"` : "No projects found."}
        </div>
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
                <th className="py-2 pr-4">Total Cost</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p) => (
                <tr key={p.name} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-medium">
                    <Link to={`/${encodeURIComponent(p.name)}/sessions`} className="text-blue-600 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{p.modified}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span style={{ color: costColorHex(projectCosts[p.name] as number | undefined, useAdaptiveColors ? projectScales[p.name] : undefined) }}>
                      {formatUSD(projectCosts[p.name] as number | undefined)}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => {
                        setNewSessionProject(p.name);
                        setNewSessionPrompt("");
                      }}
                      disabled={isCreatingSession}
                      className="px-3 py-1 text-xs sm:text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      + New Session
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for new session prompt */}
      {newSessionProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Start New Session</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Project: {newSessionProject}
            </p>

            <Form method="post" onSubmit={() => setNewSessionProject(null)}>
              <input type="hidden" name="project" value={newSessionProject} />
              <textarea
                name="prompt"
                value={newSessionPrompt}
                onChange={(e) => setNewSessionPrompt(e.target.value)}
                placeholder="Enter initial prompt for the session..."
                className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-4"
                autoFocus
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewSessionProject(null);
                    setNewSessionPrompt("");
                  }}
                  className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSession || !newSessionPrompt.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreatingSession ? "Creating..." : "Start Session"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </main>
  );
}
