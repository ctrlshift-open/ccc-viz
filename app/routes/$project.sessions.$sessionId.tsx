// Note: server-only Node imports are loaded dynamically within the loader
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useFetcher, useLoaderData, useLocation, useNavigate } from "react-router";
import { MessageTypeIcon, getMessageTypeIcon } from "~/components/MessageTypeIcon";
import { CancelButton } from "~/components/CancelButton";
import { FileViewer } from "~/welcome/FileViewer";
import type { Route } from "./+types/$project.sessions.$sessionId";
import { formatUSD, costColorHex } from "~/utils/format";

type ParsedLine =
  | { ok: true; value: unknown; line: number }
  | { ok: false; value: string; line: number };

type Dir = "asc" | "desc";

function formatProjectTitle(projectPath: string): string {
  // Extract project name from path like '-Users-barendt-code-archeology'
  // Replace 'code-' prefix with just the project name
  const segments = projectPath.split('-').filter(Boolean);

  // Find 'code' segment and take everything after it
  const codeIndex = segments.indexOf('code');
  if (codeIndex >= 0 && codeIndex < segments.length - 1) {
    return segments.slice(codeIndex + 1).join('-');
  }

  // Fallback: return the original path
  return projectPath;
}

export function meta({ data }: Route.MetaArgs) {
  if (!data || 'error' in data) {
    return [{ title: "ccc-viz" }];
  }

  const projectTitle = formatProjectTitle(data.project);
  return [{ title: `${projectTitle}` }];
}

export async function action({ request, params }: Route.ActionArgs) {
  const project = params.project!;
  const sessionId = params.sessionId!;
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Handle file reading intent
  if (intent === "readFile") {
    const filepath = formData.get("filepath");

    if (!filepath || typeof filepath !== "string") {
      return { success: false, error: "File path is required" };
    }

    const { resolveSessionFile } = await import("~/utils/path-safety.server");
    const { file } = resolveSessionFile(project, sessionId);
    const { readFile } = await import("node:fs/promises");
    const { join, resolve, relative } = await import("node:path");
    const { stat } = await import("node:fs/promises");

    try {
      // Get working directory from session file
      const content = await readFile(file, "utf8");
      const lines = content.split("\n").filter(l => l.trim());
      let workingDirectory = "/";

      for (let i = 0; i < Math.min(20, lines.length); i++) {
        try {
          const parsed = JSON.parse(lines[i]);
          if (parsed.cwd && typeof parsed.cwd === "string") {
            workingDirectory = parsed.cwd;
            break;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }

      if (workingDirectory === "/") {
        return { success: false, error: "Could not determine working directory" };
      }

      // Resolve and validate file path
      const fullPath = resolve(workingDirectory, filepath);
      const relativePath = relative(workingDirectory, fullPath);

      // Security check: prevent directory traversal
      if (relativePath.startsWith('..') || fullPath.indexOf(workingDirectory) !== 0) {
        return { success: false, error: "Invalid file path - outside project directory" };
      }

      // Check file size (max 1MB)
      const stats = await stat(fullPath);
      if (stats.size > 1024 * 1024) {
        return { success: false, error: "File too large (max 1MB)" };
      }

      // Read file contents
      const fileContent = await readFile(fullPath, "utf8");

      return {
        success: true,
        filepath,
        content: fileContent,
        size: stats.size,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { success: false, error: "File not found" };
      } else if (error.code === 'EACCES') {
        return { success: false, error: "Permission denied" };
      }
      return { success: false, error: `Failed to read file: ${error.message}` };
    }
  }

  // Handle prompt submission intent (default)
  const prompt = formData.get("prompt");
  const model = formData.get("model");

  if (!prompt || typeof prompt !== "string") {
    return { success: false, error: "Prompt is required", output: "", exitCode: 1 };
  }

  const { resolveSessionFile } = await import("~/utils/path-safety.server");
  const { file } = resolveSessionFile(project, sessionId);
  const { readFile } = await import("node:fs/promises");

  let workingDirectory = "/";
  try {
    console.log("[action] Reading session file:", file);
    const content = await readFile(file, "utf8");
    const lines = content.split("\n").filter(l => l.trim());
    console.log("[action] File has", lines.length, "lines");

    // Scan first 20 lines to find one with cwd
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      try {
        const parsed = JSON.parse(lines[i]);
        if (parsed.cwd && typeof parsed.cwd === "string") {
          workingDirectory = parsed.cwd;
          console.log("[action] Found cwd in line", i + 1, ":", workingDirectory);
          break;
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    if (workingDirectory === "/") {
      console.log("[action] No cwd field found in first 20 lines");
    }
  } catch (error) {
    console.error("[action] Failed to read cwd from session file:", error);
  }

  // Run CLI in background without awaiting
  const { sendPromptToSession } = await import("~/claude-cli.server");
  console.log("[action] Starting background CLI execution for session:", sessionId);
  console.log("[action] Working directory:", workingDirectory);
  console.log("[action] Prompt:", prompt.slice(0, 100));

  sendPromptToSession(sessionId, prompt, {
    model: model && typeof model === "string" ? model : undefined,
    printMode: true,
    workingDirectory,
  }).then((result) => {
    console.log("[action] CLI execution completed:", result.success ? "success" : "failed");
    if (!result.success) {
      console.error("[action] CLI execution failed:", result.error);
      console.error("[action] CLI output:", result.output);
    } else {
      console.log("[action] CLI output length:", result.output.length);
    }
  }).catch((error) => {
    console.error("[action] CLI execution threw error:", error);
  });

  // Return immediately
  return { success: true, message: "Prompt sent to Claude CLI", output: "", exitCode: 0 };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const project = params.project!;
  const sessionId = params.sessionId!;
  const { resolveSessionFile } = await import("~/utils/path-safety.server");
  const { base: baseDir, file } = resolveSessionFile(project, sessionId);
  const { readFile } = await import("node:fs/promises");

  const url = new URL(request.url);
  const dir: Dir = (url.searchParams.get("dir") as Dir) || "desc";
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "25", 10) || 25));
  const cursor = Math.max(0, parseInt(url.searchParams.get("cursor") || "0", 10) || 0);

  try {
    const content = await readFile(file, "utf8");
    const allLines = content.split(/\r?\n/).filter((l) => l.length > 0);
    const total = allLines.length;

    const orderedIndices = dir === "asc"
      ? Array.from({ length: total }, (_, i) => i)
      : Array.from({ length: total }, (_, i) => total - 1 - i);

    const start = Math.min(cursor, Math.max(0, orderedIndices.length));
    const pageIdx = orderedIndices.slice(start, start + limit);

    const parsed: ParsedLine[] = pageIdx.map((i) => {
      const lineStr = allLines[i];
      try {
        return { ok: true, value: JSON.parse(lineStr), line: i } as const;
      } catch {
        return { ok: false, value: lineStr, line: i } as const;
      }
    });

    const nextCursor = start + limit < orderedIndices.length ? String(start + limit) : null;

    // Collect category options across the entire file, not just current page
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

    // Compute and attach costs using ccusage (offline pricing to avoid network fetches)
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

      // Attach per-entry cost to current page items
      await Promise.all(
        parsed.map(async (item) => {
          if (!item.ok) return;
          const v: any = item.value;
          try {
            const cost = await calculateCostForEntry(v, "auto", fetcher);
            if (typeof v === "object" && v) v.costUSD = cost;
          } catch { }
        })
      );

      // Compute totals across the whole session file
      let totalUSD = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheCreationTokens = 0;
      let cacheReadTokens = 0;
      const allMessageCosts: number[] = [];
      let currentCtx: { used: number; limit?: number; pct?: number } | undefined;
      let foundPrimary = false;
      // First pass: aggregate and remember last assistant with usage/model
      for (const line of allLines) {
        try {
          const v = JSON.parse(line);
          try {
            const cost = await calculateCostForEntry(v, "auto", fetcher);
            if (typeof cost === "number" && Number.isFinite(cost)) {
              totalUSD += cost;
              if (cost > 0) allMessageCosts.push(cost);
            }
          } catch { }
          const u = (v?.message?.usage ?? {}) as any;
          if (typeof u.input_tokens === "number") inputTokens += u.input_tokens;
          if (typeof u.output_tokens === "number") outputTokens += u.output_tokens;
          if (typeof u.cache_creation_input_tokens === "number") cacheCreationTokens += u.cache_creation_input_tokens;
          if (typeof u.cache_read_input_tokens === "number") cacheReadTokens += u.cache_read_input_tokens;
          // Track latest assistant usage; prefer primary (not sidechain) if available
          if (v?.type === "assistant" && v?.message?.model && (u?.input_tokens || u?.cache_creation_input_tokens || u?.cache_read_input_tokens)) {
            const isSide = Boolean(v?.isSidechain);
            const used = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
            // If we haven't found a primary, update. If this is primary, mark and set.
            if (!foundPrimary || !isSide) {
              currentCtx = { used };
              if (!isSide) foundPrimary = true;
              (currentCtx as any).model = v.message.model;
            }
          }
        } catch { }
      }
      totals = { totalUSD, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens };
      // Build dynamic message cost scale using p50 and p90
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
      // Resolve context limit for the chosen currentCtx
      if (currentCtx && (currentCtx as any).model) {
        try {
          const res = await fetcher.getModelContextLimit((currentCtx as any).model);
          const limit = res && res.type === "Success" && typeof res.value === "number" ? res.value : undefined;
          if (limit && limit > 0) currentCtx = { used: currentCtx.used, limit, pct: currentCtx.used / limit };
        } catch { }
      }
      (globalThis as any)._ccvizCurrentCtx = currentCtx; // debug aid
    } catch {
      // If ccusage import fails, continue without cost info
    }

    // Detect new/modified .md files using git status
    let modifiedMdFiles: Array<{ filepath: string; status: string }> = [];
    let workingDirectory = "/";
    try {
      // Read working directory from session file (same as action does)
      for (let i = 0; i < Math.min(20, allLines.length); i++) {
        try {
          const parsed = JSON.parse(allLines[i]);
          if (parsed.cwd && typeof parsed.cwd === "string") {
            workingDirectory = parsed.cwd;
            break;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }

      if (workingDirectory !== "/") {
        // Dynamically import execSync to avoid SSR issues
        const { execSync } = await import("node:child_process");
        const gitStatus = execSync("git status --porcelain", {
          cwd: workingDirectory,
          encoding: "utf-8"
        });

        modifiedMdFiles = gitStatus
          .split("\n")
          .filter(line => line.trim())
          .map(line => {
            const status = line.substring(0, 2).trim();
            const filepath = line.substring(3).trim();
            return { status, filepath };
          })
          .filter(({ status, filepath }) =>
            (status === '??' || status === 'A' || status === 'M' || status.includes('M')) &&
            (filepath.endsWith('.md') || filepath === 'progress.txt' || filepath.endsWith('/progress.txt'))
          );

        // Always include .beans.md and progress.txt files even without git changes
        const { existsSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { readdirSync } = await import("node:fs");

        const alwaysShowFiles = ['progress.txt'];

        // Check for .beans.md files in .beans directory
        const beansDir = join(workingDirectory, '.beans');
        if (existsSync(beansDir)) {
          try {
            const beansFiles = readdirSync(beansDir)
              .filter(f => f.endsWith('.md'))
              .map(f => `.beans/${f}`);
            alwaysShowFiles.push(...beansFiles);
          } catch {
            // Ignore errors reading .beans directory
          }
        }

        // Add files that exist but aren't already in the list
        for (const file of alwaysShowFiles) {
          const fullPath = join(workingDirectory, file);
          if (existsSync(fullPath) && !modifiedMdFiles.some(f => f.filepath === file)) {
            modifiedMdFiles.push({ filepath: file, status: 'tracked' });
          }
        }
      }
    } catch (error) {
      console.error("[loader] Failed to get git status:", error);
      // Continue without file list - not critical
    }

    return {
      baseDir,
      project,
      sessionId,
      file,
      parsed,
      categories,
      meta: { total, limit, cursor: start, nextCursor, dir },
      totals,
      messageCostScale,
      currentCtx: (globalThis as any)._ccvizCurrentCtx,
      modifiedMdFiles,
      workingDirectory,
    };
  } catch (error) {
    return {
      baseDir,
      project,
      sessionId,
      file,
      parsed: [],
      categories: [],
      meta: { total: 0, limit, cursor, nextCursor: null, dir },
      error: `Failed to read session: ${(error as Error).message}`,
      modifiedMdFiles: [],
      workingDirectory: "/",
    };
  }
}

export default function SessionDetails() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();

  const [items, setItems] = useState(data.parsed);
  const [pendingPrompts, setPendingPrompts] = useState<Array<{ id: string; text: string; timestamp: string }>>([]);
  const [seenLines, setSeenLines] = useState<Set<number>>(() => new Set((data.parsed || []).map((p: any) => p.line as number)));
  const seenLinesRef = useRef<Set<number>>(seenLines);
  const [nextCursor, setNextCursor] = useState<string | null>(data.meta.nextCursor);
  const [dir, setDir] = useState<Dir>(data.meta.dir);
  const [showLegend, setShowLegend] = useState(false);
  const [useAdaptiveColors, setUseAdaptiveColors] = useState(true);
  const [totals, setTotals] = useState(data.totals);
  const [messageCostScale, setMessageCostScale] = useState(data.messageCostScale);
  const [currentCtx, setCurrentCtx] = useState<{ used: number; limit?: number; pct?: number } | undefined>((data as any).currentCtx);
  type Cat = { key: string; label: string; count: number };
  const [catOptions, setCatOptions] = useState<Cat[]>(data.categories || []);
  const [metaTotal, setMetaTotal] = useState<number>(data.meta.total);
  const [liveConnected, setLiveConnected] = useState<boolean>(false);
  const [isStopped, setIsStopped] = useState<boolean>(false);
  const [activeReason, setActiveReason] = useState<string | null>(null);
  const [activeThresholdSec] = useState<number>(1800);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [pendingDir, setPendingDir] = useState<Dir | null>(null);

  // Files tab state
  const [viewMode, setViewMode] = useState<"messages" | "files">("messages");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const fileFetcher = useFetcher<any>();

  // Handle file click
  const handleFileClick = (filepath: string) => {
    setSelectedFile(filepath);
    const formData = new FormData();
    formData.append("intent", "readFile");
    formData.append("filepath", filepath);
    fileFetcher.submit(formData, { method: "post" });
  };

  // Update file content when fetcher completes
  useEffect(() => {
    if (fileFetcher.state === "idle" && fileFetcher.data) {
      const data = fileFetcher.data as any;
      if (data.success && data.content) {
        setFileContent(data.content);
      } else if (!data.success && data.error) {
        alert(`Error loading file: ${data.error}`);
        setSelectedFile(null);
      }
    }
  }, [fileFetcher.state, fileFetcher.data]);

  // Close file viewer
  const handleCloseFile = () => {
    setSelectedFile(null);
    setFileContent(null);
  };

  // Update document title when status changes
  useEffect(() => {
    const statusEmoji = isStopped ? '🔴' : '🟢';
    const projectTitle = formatProjectTitle(data.project);
    document.title = `${statusEmoji} ${projectTitle}`;
  }, [isStopped, data.project]);
  const selectedDir = useMemo<Dir>(() => {
    const sp = new URLSearchParams(location.search);
    const d = (sp.get("dir") as Dir) || data.meta.dir || "desc";
    const current = d === "asc" ? "asc" : "desc";
    return pendingDir ?? current;
  }, [location.search, data.meta.dir, pendingDir]);
  useEffect(() => {
    // Clear any optimistic selection once URL changes
    setPendingDir(null);
  }, [location.search]);
  const condensed = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get("view") === "condensed";
  }, [location.search]);
  // Category selection synced to URL (?cats=key1,key2)
  const catsParam = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get("cats") || "";
  }, [location.search]);
  const selectedCats = useMemo(() => {
    const s = new Set<string>();
    for (const part of catsParam.split(",")) {
      const k = part.trim();
      if (k) s.add(k);
    }
    return s;
  }, [catsParam]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Load persisted adaptive color preference per project
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`ccviz:adaptiveColors:${data.project}`);
      if (raw != null) setUseAdaptiveColors(raw === "true");
    } catch { }
  }, [data.project]);

  const toggleAdaptive = () => {
    setUseAdaptiveColors((prev) => {
      const next = !prev;
      try { localStorage.setItem(`ccviz:adaptiveColors:${data.project}`, String(next)); } catch { }
      return next;
    });
  };

  // Persist manually opened card UUIDs in localStorage per session
  const storageKey = useMemo(
    () => `ccviz:open:${encodeURIComponent(data.project)}:${encodeURIComponent(data.sessionId)}`,
    [data.project, data.sessionId]
  );
  const [manualOpenUuids, setManualOpenUuids] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setManualOpenUuids(new Set());
        return;
      }
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) setManualOpenUuids(new Set(arr.filter((x) => typeof x === "string")));
      else setManualOpenUuids(new Set());
    } catch {
      setManualOpenUuids(new Set());
    }
  }, [storageKey]);

  const persistManualOpen = (next: Set<string>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
    } catch { }
  };
  const clearManualOpens = () => {
    setManualOpenUuids(new Set());
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(storageKey);
      } catch { }
    }
  };
  const handleManualToggle = (uuid: string | undefined, expanded: boolean) => {
    if (!uuid) return; // only persist for known UUIDs
    setManualOpenUuids((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(uuid);
      else next.delete(uuid);
      persistManualOpen(next);
      return next;
    });
  };

  // Reset view state when dir or session changes
  useEffect(() => {
    setItems(data.parsed);
    const initialSeen = new Set((data.parsed || []).map((p: any) => p.line as number));
    setSeenLines(initialSeen);
    seenLinesRef.current = initialSeen;
    setNextCursor(data.meta.nextCursor);
    setDir(data.meta.dir);
    setTotals(data.totals);
    setMessageCostScale(data.messageCostScale);
    setCatOptions(data.categories || []);
    setMetaTotal(data.meta.total);
  }, [data.sessionId, data.meta.dir]);

  // Append newly fetched items
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && (fetcher.data as any).parsed) {
      const incomingAll = (fetcher.data as any).parsed as typeof data.parsed;
      // Deduplicate by line number
      const filtered = incomingAll.filter((it: any) => !seenLinesRef.current.has(it.line as number));
      if (filtered.length === 0) return;
      const next = (fetcher.data as any).meta?.nextCursor as string | null;
      setItems((prev) => [...prev, ...filtered]);
      setSeenLines((prev) => {
        const s = new Set(prev);
        for (const it of filtered) s.add(it.line as number);
        seenLinesRef.current = s;
        return s;
      });
      setNextCursor(next);

      // Update current context if any incoming assistant message has usage + model
      try {
        for (const it of filtered) {
          if (!it?.ok) continue;
          const v: any = it.value;
          const u = v?.message?.usage || {};
          const model = v?.message?.model;
          if (v?.type === 'assistant' && model && (u.input_tokens || u.cache_creation_input_tokens || u.cache_read_input_tokens)) {
            const used = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
            // Optimistically set used; limit will update on next totals refresh
            setCurrentCtx((prev) => ({ used, limit: prev?.limit, pct: prev?.limit ? used / prev.limit : undefined }));
          }
        }
      } catch { }
    }
  }, [fetcher.state, fetcher.data]);

  // Live updates via SSE stream with backoff and status
  const streamUrl = useMemo(() => {
    // Use initial total from loader to seed tailer only on first connect
    return `/api/sessions/${encodeURIComponent(data.project)}/${encodeURIComponent(
      data.sessionId
    )}/stream?fromLine=${encodeURIComponent(String(data.meta.total))}&dir=${encodeURIComponent(dir)}`;
  }, [data.project, data.sessionId, dir, data.meta.total]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let es: EventSource | null = null;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastActivityAt = Date.now();

    const onAppend = (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data) as { items?: any[] };
        if (!payload?.items || !Array.isArray(payload.items) || payload.items.length === 0) return;
        console.log("[SSE] Received", payload.items.length, "items");
        // Deduplicate by line number
        const newOnes = (payload.items as any[]).filter((it) => typeof it?.line === "number" && !seenLinesRef.current.has(it.line));
        console.log("[SSE] After dedup:", newOnes.length, "new items");
        if (newOnes.length === 0) return;

        // Check if any new messages are user messages - if so, clear pending prompts FIRST
        const hasUserMessage = newOnes.some((it) => it.ok && (it.value as any)?.type === "user");
        if (hasUserMessage) {
          console.log("[SSE] User message received, clearing pending prompts");
          setPendingPrompts([]);
        }

        console.log("[SSE] Adding", newOnes.length, "items. Dir:", dir, "Current items:", items.length);
        setItems((prev) => {
          const updated = dir === "desc" ? [...newOnes, ...prev] : [...prev, ...newOnes];
          console.log("[SSE] Items after update:", updated.length);
          return updated;
        });
        setSeenLines((prev) => {
          const s = new Set(prev);
          for (const it of newOnes) s.add(it.line);
          seenLinesRef.current = s;
          return s;
        });
        setMetaTotal((t) => (typeof t === "number" ? t + newOnes.length : t));
        lastActivityAt = Date.now();
        setIsStopped(false);
        setActiveReason("recent-write");
        // Update last event timestamp using newest payload item timestamp when available
        try {
          const items = newOnes || [];
          let latest: number | null = null;
          for (const it of items) {
            if (!it || !it.ok) continue;
            const ts = (it.value as any)?.timestamp;
            const t = ts ? new Date(ts).getTime() : NaN;
            if (Number.isFinite(t)) { latest = latest == null ? t : Math.max(latest, t); }
          }
          if (latest != null) setLastEventTimestamp(new Date(latest).toISOString());
          else setLastEventTimestamp(new Date().toISOString());
        } catch { }
      } catch { }
    };

    const connect = () => {
      if (closed) return;
      try { if (es) { es.close(); es = null; } } catch { }
      console.log("[SSE] Connecting to:", streamUrl);
      const next = new EventSource(streamUrl);
      es = next;
      next.onopen = () => {
        console.log("[SSE] Connected");
        setLiveConnected(true);
        retry = 0;
      };
      next.addEventListener("append", onAppend);
      next.addEventListener("ready", (e) => {
        console.log("[SSE] Stream ready");
      });
      next.addEventListener("ping", () => {
        console.log("[SSE] Ping received");
      });
      next.onerror = (err) => {
        console.error("[SSE] Error:", err);
        setLiveConnected(false);
        try { next.removeEventListener("append", onAppend); } catch { }
        try { next.close(); } catch { }
        es = null;
        const base = 1000;
        const max = 20000;
        const delay = Math.min(max, base * Math.pow(2, retry++)) + Math.floor(Math.random() * 300);
        console.log("[SSE] Reconnecting in", delay, "ms");
        if (!closed) {
          timer = setTimeout(connect, delay);
        }
      };
    };
    connect();

    return () => {
      closed = true;
      if (timer) { try { clearTimeout(timer); } catch { } timer = null; }
      if (es) { try { es.removeEventListener("append", onAppend); } catch { } try { es.close(); } catch { } }
    };
  }, [streamUrl, dir]);

  // Poll session active state periodically
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const poll = () => {
      const url = `/api/sessions/${encodeURIComponent(data.project)}/${encodeURIComponent(data.sessionId)}/active?thresholdSec=${activeThresholdSec}`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((res) => {
          if (cancelled) return;
          if (typeof res.reason === "string") setActiveReason(res.reason);
          if (typeof res.lastEventTimestamp === "string") setLastEventTimestamp(res.lastEventTimestamp);
          if (typeof res.lastEventIsStop === "boolean") setIsStopped(res.lastEventIsStop);
        })
        .catch(() => { /* ignore */ });
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [data.project, data.sessionId, activeThresholdSec]);

  // Live counter for time since last message
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      setNowTick(Date.now());
      timer = setTimeout(tick, 1000);
    };
    timer = setTimeout(tick, 1000);
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  const sinceLastMessageMs = useMemo(() => {
    if (!lastEventTimestamp) return null;
    const t = new Date(lastEventTimestamp).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.max(0, nowTick - t);
  }, [lastEventTimestamp, nowTick]);

  function formatElapsed(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const nextUrl = useMemo(() => {
    if (nextCursor == null) return null;
    const params = new URLSearchParams(location.search);
    params.set("cursor", String(nextCursor));
    params.set("dir", dir);
    return `?${params.toString()}`;
  }, [location.search, nextCursor, dir]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (!first?.isIntersecting) return;
      if (!nextUrl || fetcher.state !== "idle") return;
      fetcher.load(nextUrl);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [fetcher, nextUrl]);

  const toggleUrl = (newDir: Dir) => {
    const params = new URLSearchParams(location.search);
    params.set("dir", newDir);
    params.delete("cursor");
    return `?${params.toString()}`;
  };

  const setViewUrl = (mode: "condensed" | "detailed") => {
    const params = new URLSearchParams(location.search);
    if (mode === "condensed") params.set("view", "condensed");
    else params.delete("view");
    params.delete("cursor");
    return `?${params.toString()}`;
  };

  // Category options (from initial load or recompute)
  const catOptionsMemo = catOptions;

  // Build expanded map from selectedCats for convenience and pass down
  const categoryExpanded = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of catOptionsMemo) map[c.key] = selectedCats.has(c.key);
    return map;
  }, [catOptionsMemo, selectedCats]);

  const categoryVersion = catsParam; // string token to notify children of change

  const buildCatsUrl = (nextSet: Set<string>) => {
    const params = new URLSearchParams(location.search);
    if (nextSet.size > 0) params.set("cats", Array.from(nextSet).join(","));
    else params.delete("cats");
    params.delete("cursor");
    return `?${params.toString()}`;
  };
  const toggleCategoryUrl = (key: string) => {
    const next = new Set(Array.from(selectedCats));
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return buildCatsUrl(next);
  };
  const setAllCategoriesUrl = (expanded: boolean) => {
    if (!expanded) return buildCatsUrl(new Set());
    const all = new Set<string>();
    for (const c of catOptionsMemo) all.add(c.key);
    return buildCatsUrl(all);
  };

  const messageScaleUsed = useAdaptiveColors ? (messageCostScale as any) : undefined;

  const totalsFetcher = useFetcher<any>();
  const recomputeTotals = () => {
    const path = `/api/sessions/${encodeURIComponent(data.project)}/${encodeURIComponent(data.sessionId)}/totals`;
    totalsFetcher.load(path);
  };

  useEffect(() => {
    if (totalsFetcher.state === "idle" && totalsFetcher.data) {
      const d = totalsFetcher.data as any;
      if (d && !d.error) {
        if (typeof d.totalLines === "number") setMetaTotal(d.totalLines);
        if (d.totals) setTotals(d.totals);
        if (d.messageCostScale) setMessageCostScale(d.messageCostScale);
        if (Array.isArray(d.categories)) setCatOptions(d.categories);
        if (d.currentCtx) setCurrentCtx(d.currentCtx);
      }
    }
  }, [totalsFetcher.state, totalsFetcher.data]);

  return (
    <main className="p-4 pt-16 md:pt-4 max-w-screen-md mx-auto overflow-x-hidden">
      <h1 className="text-xl font-semibold mb-2">
        {isStopped ? '🔴' : '🟢'} {formatProjectTitle(data.project)} - Session Details
      </h1>
      <p className="text-sm text-gray-500 mb-4 break-all">
        Project: <strong>{data.project}</strong> · Session: <strong>{data.sessionId}</strong>
      </p>
      <div className="mb-3 text-sm text-gray-400 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2">
          <span>
            Total cost: <strong style={{ color: costColorHex(totals?.totalUSD as number | undefined, messageScaleUsed) }}>{formatUSD(totals?.totalUSD as number | undefined)}</strong>
          </span>
          <span className="text-gray-600">|</span>
          <span>
            tokens in {typeof totals?.inputTokens === "number" ? totals!.inputTokens : "—"}
            {" "}· out {typeof totals?.outputTokens === "number" ? totals!.outputTokens : "—"}
          </span>
          {currentCtx && typeof currentCtx.used === 'number' ? (
            <>
              <span className="text-gray-600">|</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-xs text-gray-500">Context</span>
                <ContextIndicator ctx={currentCtx} />
                {currentCtx.limit ? (
                  <span className="text-[10px] text-gray-500">{currentCtx.used}/{currentCtx.limit}</span>
                ) : (
                  <span className="text-[10px] text-gray-500">{currentCtx.used}</span>
                )}
              </span>
            </>
          ) : null}
        </span>
        <button type="button" className="text-blue-500 hover:underline" onClick={() => setShowLegend((s) => !s)}>
          {showLegend ? "Hide legend" : "Show legend"}
        </button>
        <label className="inline-flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={useAdaptiveColors} onChange={toggleAdaptive} />
          <span>Adaptive colors</span>
        </label>
        <button
          type="button"
          onClick={recomputeTotals}
          className="text-blue-500 hover:underline"
          disabled={totalsFetcher.state !== "idle"}
          title="Recompute totals, categories, and cost scale"
        >
          {totalsFetcher.state === "idle" ? "Recompute totals" : "Recomputing…"}
        </button>
        <span className="ml-auto inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1" title={liveConnected ? "Live connected" : "Live disconnected"}>
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${liveConnected ? "bg-green-500" : "bg-red-500"}`}></span>
            <span className="text-xs">Live</span>
          </span>
          {isStopped ? (
            <span className="inline-flex items-center gap-1" title={activeReason || "stopped"}>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-500"></span>
              <span className="text-xs">Stopped</span>
            </span>
          ) : null}
        </span>
      </div>
      <div className="mb-3 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1">
          <span className="text-gray-500">Since last message:</span>
          <span>{sinceLastMessageMs != null ? formatElapsed(sinceLastMessageMs) : "—"}</span>
        </span>
      </div>
      {showLegend ? (
        <div className="mb-3 text-xs text-gray-300 border border-gray-700 bg-gray-900 rounded p-2">
          {messageScaleUsed ? (
            <div>
              <div>Green ≤ {formatUSD(messageScaleUsed.greenMax)}</div>
              <div>Yellow ≤ {formatUSD(messageScaleUsed.yellowMax)}</div>
              <div>Red up to {formatUSD((messageScaleUsed.redMax ?? (messageScaleUsed.yellowMax * 4)) as number)}</div>
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
      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <Link
          to={`/${encodeURIComponent(data.project)}/sessions`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/${encodeURIComponent(data.project)}/sessions`);
          }}
          className="text-blue-600 hover:underline"
        >
          ← Back to sessions
        </Link>
        <Link to="/" className="text-blue-600 hover:underline">
          ← Back to projects
        </Link>
        <span className="text-sm text-gray-600">Total lines: {metaTotal}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm">Sort:</span>
          <Link
            to={toggleUrl("desc")}
            onClick={() => setPendingDir("desc")}
            className={selectedDir === "desc" ? "font-semibold underline" : "text-blue-600 hover:underline"}
          >
            Desc
          </Link>
          <span className="text-gray-300">|</span>
          <Link
            to={toggleUrl("asc")}
            onClick={() => setPendingDir("asc")}
            className={selectedDir === "asc" ? "font-semibold underline" : "text-blue-600 hover:underline"}
          >
            Asc
          </Link>
          <span className="text-gray-300">|</span>
          <Link
            to={setViewUrl(condensed ? "detailed" : "condensed")}
            className="text-sm text-blue-600 hover:underline"
            aria-pressed={condensed}
          >
            {condensed ? "Detailed view" : "Condensed view"}
          </Link>
        </div>
      </div>

      {/* View mode toggle: Messages vs Files */}
      <div className="mb-3 flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setViewMode("messages")}
          className={`px-3 py-1.5 rounded border text-sm ${
            viewMode === "messages"
              ? "bg-blue-900 text-blue-200 border-blue-600"
              : "bg-gray-900 text-gray-300 border-gray-600 hover:bg-gray-800"
          }`}
        >
          Messages
        </button>
        <button
          type="button"
          onClick={() => setViewMode("files")}
          className={`px-3 py-1.5 rounded border text-sm inline-flex items-center gap-1 ${
            viewMode === "files"
              ? "bg-blue-900 text-blue-200 border-blue-600"
              : "bg-gray-900 text-gray-300 border-gray-600 hover:bg-gray-800"
          }`}
        >
          Files
          {data.modifiedMdFiles && data.modifiedMdFiles.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-medium">
              {data.modifiedMdFiles.length}
            </span>
          )}
        </button>
      </div>

      {condensed && viewMode === "messages" && catOptions.length > 0 ? (
        <div className="mb-3 rounded border border-gray-600 bg-black p-2 overflow-x-hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-400">Expand types:</span>
            {catOptions.map((c) => {
              const on = !!categoryExpanded[c.key];
              const cls = on
                ? "bg-blue-900 text-blue-200 border-blue-600"
                : "bg-gray-900 text-gray-300 border-gray-600";
              const Icon = getMessageTypeIcon(c.key);
              return (
                <Link
                  key={c.key}
                  to={toggleCategoryUrl(c.key)}
                  className={`px-2 py-1 rounded border text-sm flex items-center gap-1 ${cls}`}
                  aria-pressed={on}
                  title={c.key}
                >
                  <Icon />
                  <span className="text-xs">({c.count})</span>
                </Link>
              );
            })}
            <span className="text-gray-600">|</span>
            <Link to={setAllCategoriesUrl(true)} className="text-xs sm:text-sm text-blue-400 hover:underline">
              Expand all
            </Link>
            <Link to={setAllCategoriesUrl(false)} className="text-xs sm:text-sm text-blue-400 hover:underline">
              Collapse all
            </Link>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                // Find the most recent non-tool message
                const nonToolItems = items.filter((it) => {
                  if (!it.ok) return false;
                  const v = it.value as any;
                  const content = v?.message?.content;
                  const segs: any[] = Array.isArray(content) ? content : content ? [content] : [];
                  // Exclude tool_use and tool_result
                  const hasToolUse = segs.find((s) => s && s.type === "tool_use");
                  const hasToolResult = segs.find((s) => s && s.type === "tool_result");
                  return !hasToolUse && !hasToolResult;
                });

                if (nonToolItems.length > 0) {
                  const mostRecent = nonToolItems[0]; // First item in desc order
                  const uuid = (mostRecent.value as any)?.uuid || (mostRecent.value as any)?.message?.id || (mostRecent.value as any)?.leafUuid;
                  if (uuid) {
                    const next = new Set([uuid]);
                    setManualOpenUuids(next);
                    persistManualOpen(next);
                  }
                }
              }}
              className="text-xs sm:text-sm text-blue-400 hover:underline"
              title="Expand only the most recent non-tool message"
            >
              Latest only
            </a>
            <span className="text-gray-600">|</span>
            <button
              type="button"
              onClick={clearManualOpens}
              className="text-xs sm:text-sm text-blue-400 hover:underline"
              title="Clear manually opened entries"
            >
              Clear manual opens{manualOpenUuids.size ? ` (${manualOpenUuids.size})` : ""}
            </button>
          </div>
        </div>
      ) : null}

      <CancelButton
        project={data.project}
        sessionId={data.sessionId}
        onCancelled={() => {
          // Optionally refresh data or clear pending prompts when cancelled
          console.log("[CancelButton] Process cancelled");
        }}
      />

      <PromptForm
        onPromptSubmit={(text) => {
          const pending = {
            id: `pending-${Date.now()}`,
            text,
            timestamp: new Date().toISOString(),
          };
          setPendingPrompts((prev) => [...prev, pending]);
        }}
      />

      {/* File Grid View */}
      {viewMode === "files" && (
        <div className="space-y-3">
          {data.modifiedMdFiles && data.modifiedMdFiles.length > 0 ? (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              {data.modifiedMdFiles.map((file) => {
                const statusColor =
                  file.status === "??" || file.status === "A"
                    ? "bg-green-900 text-green-200 border-green-700"
                    : file.status === "tracked"
                    ? "bg-blue-900 text-blue-200 border-blue-700"
                    : "bg-yellow-900 text-yellow-200 border-yellow-700";
                const statusLabel =
                  file.status === "??" || file.status === "A"
                    ? "New"
                    : file.status === "tracked"
                    ? "Tracked"
                    : "Modified";

                return (
                  <button
                    key={file.filepath}
                    type="button"
                    onClick={() => handleFileClick(file.filepath)}
                    className="rounded border border-gray-600 bg-gray-900 hover:bg-gray-800 p-4 text-left transition-colors min-h-[80px] flex flex-col gap-2"
                  >
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-blue-400 shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white break-words">
                          {file.filepath.split("/").pop()}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {file.filepath.split("/").slice(0, -1).join("/") || "."}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded border text-xs ${statusColor} shrink-0`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm">No tracked files in this session</p>
              <p className="text-xs text-gray-600 mt-1">
                Shows .beans/*.md, progress.txt, and modified .md files
              </p>
            </div>
          )}
        </div>
      )}

      {/* Messages View */}
      {viewMode === "messages" && (
        <>
          {data.error ? (
            <div className="text-red-600">{data.error}</div>
          ) : items.length === 0 ? (
            <div className="text-gray-600">No JSON lines found.</div>
          ) : (
            <div className={condensed ? "flex flex-wrap gap-2" : "grid gap-3"}>
          {dir === "desc" && pendingPrompts.map((pending) => (
            <div
              key={pending.id}
              className="rounded border border-gray-600 bg-black p-2 sm:p-3 text-white opacity-50 animate-pulse"
            >
              <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-0.5 rounded border text-xs bg-gray-50 text-gray-700 border-gray-200">user</span>
                <span className="text-gray-400">{new Date(pending.timestamp).toLocaleTimeString()}</span>
                <span className="text-gray-500 text-xs">Sending...</span>
              </div>
              <div className="text-sm sm:text-base text-gray-100 whitespace-pre-wrap break-words break-all max-w-full">
                {pending.text}
              </div>
            </div>
          ))}
          {items.map((item, idx) => {
            // Get previous item's timestamp for duration calculation
            // In desc order, the "previous" message in time is actually the next item in the array
            const isDesc = data.meta.dir === 'desc';
            const prevIdx = isDesc ? idx + 1 : idx - 1;
            const prevTimestamp = prevIdx >= 0 && prevIdx < items.length && items[prevIdx].ok ?
              (items[prevIdx].value as any)?.timestamp : null;
            const currentTimestamp = item.ok ? (item.value as any)?.timestamp : null;

            return (
              <EntryCard
                key={item.line}
                item={item}
                idx={idx}
                condensed={condensed}
                categoryExpanded={categoryExpanded}
                categoryVersion={categoryVersion}
                onManualToggle={handleManualToggle}
                manualOpenUuids={manualOpenUuids}
                previousTimestamp={prevTimestamp}
                currentTimestamp={currentTimestamp}
                messageCostScale={messageScaleUsed as any}
              />
            );
          })}
          {dir === "asc" && pendingPrompts.map((pending) => (
            <div
              key={pending.id}
              className="rounded border border-gray-600 bg-black p-2 sm:p-3 text-white opacity-50 animate-pulse"
            >
              <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-0.5 rounded border text-xs bg-gray-50 text-gray-700 border-gray-200">user</span>
                <span className="text-gray-400">{new Date(pending.timestamp).toLocaleTimeString()}</span>
                <span className="text-gray-500 text-xs">Sending...</span>
              </div>
              <div className="text-sm sm:text-base text-gray-100 whitespace-pre-wrap break-words break-all max-w-full">
                {pending.text}
              </div>
            </div>
          ))}

          <div ref={sentinelRef} className="py-6 text-center text-sm text-gray-500">
            {nextCursor ? (fetcher.state === "idle" ? "Load more…" : "Loading…") : "End of results"}
          </div>
        </div>
          )}
        </>
      )}

      {/* File Viewer Modal */}
      {selectedFile && fileContent && (
        <FileViewer
          filepath={selectedFile}
          content={fileContent}
          onClose={handleCloseFile}
        />
      )}
    </main>
  );
}

type AnyJson = Record<string, unknown> | unknown[] | null;

function stringifyJson(x: unknown): string {
  try {
    return JSON.stringify(x as AnyJson, null, 2);
  } catch {
    return String(x);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function getModelEmoji(model: string | undefined): string {
  if (!model) return "";

  // Opus models (most expensive/capable)
  if (model.includes("opus")) return "💎";

  // Sonnet models - omit
  if (model.includes("sonnet")) return "";

  // Haiku models (fast/cheap)
  if (model.includes("haiku")) return "⚡";

  // All other models
  return "❓";
}


function SafePre({ children, className = "" }: { children: string; className?: string }) {
  return (
    <pre className={`text-xs sm:text-sm whitespace-pre-wrap break-words break-all max-w-full ${className}`}>
      <code>{children}</code>
    </pre>
  );
}

function ContextIndicator({ ctx }: { ctx?: { used?: number; limit?: number; pct?: number } }) {
  if (!ctx || typeof ctx.used !== "number" || !ctx.limit || !ctx.pct) return null;
  const pct = Math.max(0, Math.min(1, ctx.pct));
  const pct100 = Math.round(pct * 100);
  const color = pct > 0.8 ? "#ef4444" : pct > 0.5 ? "#f59e0b" : "#22c55e"; // red / amber / green
  return (
    <span className="inline-flex items-center gap-1" title={`context ${ctx.used}/${ctx.limit} tokens (${pct100}%)`}>
      <span className="text-[10px] text-gray-500">ctx</span>
      <span className="relative inline-block h-1 w-16 rounded bg-gray-700 overflow-hidden align-middle">
        <span
          className="absolute left-0 top-0 h-1"
          style={{ width: `${pct100}%`, backgroundColor: color }}
        />
      </span>
      <span className="text-[10px] text-gray-400">{pct100}%</span>
    </span>
  );
}

function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  if (text.includes("```")) return true; // fenced code
  if (/^\s{0,3}#{1,6}\s/m.test(text)) return true; // headings
  if (/^\s{0,3}[-*+]\s+/m.test(text)) return true; // unordered list
  if (/^\s{0,3}\d+\.\s+/m.test(text)) return true; // ordered list
  if (/^\s{0,3}>\s/m.test(text)) return true; // blockquote
  if (/\n---\n/.test(text)) return true; // hr
  return false;
}

function TextOrMarkdown({ text }: { text: string }) {
  if (looksLikeMarkdown(text)) {
    return (
      <div className="text-xs text-gray-100  max-w-full overflow-x-hidden">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h1 className="text-lg sm:text-xl font-semibold mt-3 mb-1 break-words">{children}</h1>,
            h2: ({ children }) => <h2 className="text-base sm:text-lg font-semibold mt-3 mb-1 break-words">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1 break-words">{children}</h3>,
            p: ({ children }) => (
              <p className="my-2 whitespace-pre-wrap break-words break-all">{children}</p>
            ),
            ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 break-words">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 break-words">{children}</ol>,
            li: ({ children }) => <li className="break-words">{children}</li>,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">
                {children}
              </a>
            ),
            code: ({ children, className }) => {
              const content = String(children ?? "");
              const isInline = !className?.includes('language-');
              if (isInline) {
                return <code className="px-1 py-0.5 rounded bg-gray-800 text-gray-100 text-sm break-words">{content}</code>;
              }
              return <SafePre className="mt-2">{content}</SafePre>;
            },
            hr: () => <hr className="my-3 border-t border-gray-200" />,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-gray-600 pl-3 my-2 text-gray-300">{children}</blockquote>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto max-w-full">
                <table className="w-full text-left text-sm border-collapse">{children}</table>
              </div>
            ),
            th: ({ children }) => <th className="border-b border-gray-700 px-2 py-1 font-medium">{children}</th>,
            td: ({ children }) => <td className="border-b border-gray-800 px-2 py-1 align-top">{children}</td>,
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="text-sm sm:text-base text-gray-100 whitespace-pre-wrap break-words break-all max-w-full">
      {text}
    </div>
  );
}

function Pill({ children, tone = "default" as "default" | "error" | "info" }: { children: React.ReactNode; tone?: "default" | "error" | "info" }) {
  const toneClass =
    tone === "error"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "info"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-gray-50 text-gray-700 border-gray-200";
  return <span className={`px-2 py-0.5 rounded border text-xs ${toneClass}`}>{children}</span>;
}

function EntryCard({
  item,
  idx,
  condensed = false,
  categoryExpanded,
  categoryVersion,
  onManualToggle,
  manualOpenUuids,
  previousTimestamp,
  currentTimestamp,
  messageCostScale,
}: {
  item: ParsedLine;
  idx: number;
  condensed?: boolean;
  categoryExpanded?: Record<string, boolean>;
  categoryVersion?: string;
  onManualToggle?: (uuid: string | undefined, expanded: boolean) => void;
  manualOpenUuids?: Set<string>;
  previousTimestamp?: string | null;
  currentTimestamp?: string | null;
  messageCostScale?: { greenMax: number; yellowMax: number };
}) {
  const [showRaw, setShowRaw] = useState(false);
  const [expanded, setExpanded] = useState(!condensed);
  useEffect(() => {
    setExpanded(!condensed);
  }, [condensed]);

  if (!item.ok) {
    return (
      <div className="rounded border border-gray-600 bg-black p-3 text-white">
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
          <Pill tone="error">invalid json</Pill>
          <span>Line {idx + 1}</span>
        </div>
        <SafePre className="text-red-700">{item.value}</SafePre>
      </div>
    );
  }

  const v = item.value as any;
  const topType = v?.type as string | undefined;
  const hasMessage = v && typeof v === "object" && v.message;
  const role = hasMessage ? v.message.role : undefined;
  const model = hasMessage ? v.message.model : undefined;
  const uuid: string | undefined = v?.uuid || v?.message?.id || v?.leafUuid;

  // Header chips
  const header = (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-600 min-w-0">
      {topType ? <Pill>{topType}</Pill> : <Pill>unknown</Pill>}
      {role && role !== topType ? <Pill>{role}</Pill> : null}
      {model && getModelEmoji(model) ? (
        <span className="text-base" title={model}>{getModelEmoji(model)}</span>
      ) : null}
      {currentTimestamp && previousTimestamp && topType !== 'user' ? (
        <span className="text-gray-400 truncate">
          +{formatDuration(new Date(currentTimestamp).getTime() - new Date(previousTimestamp).getTime())}
        </span>
      ) : currentTimestamp ? (
        <span className="text-gray-400 truncate">{new Date(currentTimestamp).toLocaleString()}</span>
      ) : null}
      {/* Token usage (assistant messages only, when present) */}
      {topType === "assistant" && v?.message?.usage ? (
        <span className="text-gray-500 truncate inline-flex items-center gap-1">
          <span>
            tokens: in {v.message.usage.input_tokens ?? "—"} · out {v.message.usage.output_tokens ?? "—"}
          </span>
          {typeof v?.costUSD === "number" ? (
            <>
              <span className="text-gray-600">·</span>
              <span style={{ color: costColorHex(v.costUSD as number, messageCostScale) }}>cost {formatUSD(v.costUSD)}</span>
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );

  // Condensed summary label
  const buildSummary = (): { key: string; label: string; tone?: "default" | "error" | "info"; isToolUse?: boolean } => {
    if (topType === "summary" && !hasMessage) return { key: "summary", label: "" };
    const c = v?.message?.content;
    const segs: any[] = Array.isArray(c) ? c : c ? [c] : [];
    const toolUse = segs.find((s) => s && s.type === "tool_use");
    if (toolUse) {
      const name = toolUse.name ? String(toolUse.name) : "tool";
      if (name === "TodoWrite") return { key: `${topType}|tool_use|TodoWrite`, label: name, tone: "info", isToolUse: true };
      return { key: `${topType}|tool_use`, label: name, tone: "info", isToolUse: true };
    }
    const toolRes = segs.find((s) => s && s.type === "tool_result");
    if (toolRes) {
      const isErr = Boolean(toolRes.is_error);
      return { key: `${topType}|tool_result`, label: "", tone: isErr ? "error" : "default" };
    }
    const thinking = segs.find((s) => s && s.type === "thinking");
    if (thinking) return { key: `${topType}|thinking`, label: "" };
    const hasText = segs.find((s) => typeof s === "string" || (s && s.type === "text"));
    if (hasText) return { key: `${topType}|message`, label: "" };
    return { key: `${topType}|entry`, label: "" };
  };
  const summary = buildSummary();

  // Summary events (no message)
  if (topType === "summary" && !hasMessage) {
    return (
      <div className="rounded border border-gray-600 bg-black p-2 sm:p-3 text-white">
        {condensed ? (
          <button
            type="button"
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              if (onManualToggle) onManualToggle(uuid, next);
            }}
            className="w-full text-left flex items-center gap-2 min-w-0"
            aria-expanded={expanded}
          >
            <span className="shrink-0"><Pill>summary</Pill></span>
            <span className="text-sm text-gray-900 truncate">{v?.summary || "(no summary)"}</span>
          </button>
        ) : (
          header
        )}
        {!condensed || expanded ? (
          <>
            {!condensed ? (
              <div className="text-lg text-gray-100 break-words">{v?.summary || "(no summary)"}</div>
            ) : null}
            <div className="mt-2 text-base text-gray-500">leafUuid: {v?.leafUuid || "—"}</div>
            <div className="mt-3">
              <button
                onClick={() => setShowRaw((s) => !s)}
                className="text-blue-600 text-base hover:underline"
              >
                {showRaw ? "Hide raw" : "Show raw"}
              </button>
              {showRaw ? <SafePre className="mt-2">{stringifyJson(v)}</SafePre> : null}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  // Message-based events
  const content = v?.message?.content;

  // Normalize content into array of segments
  type ContentSeg = { type?: string;[k: string]: any } | string;
  const segments: ContentSeg[] = Array.isArray(content)
    ? (content as any[])
    : typeof content === "string"
      ? [content]
      : content && typeof content === "object"
        ? [content as any]
        : [];

  // Category force-expansion support
  const catKey = (() => {
    if (topType === "summary" && !hasMessage) return "summary";
    const c = content;
    const segs: any[] = Array.isArray(c) ? c : c ? [c] : [];
    const toolUse = segs.find((s) => s && s.type === "tool_use");
    if (toolUse) {
      if (toolUse.name === "TodoWrite") return `${topType}|tool_use|TodoWrite`;
      return `${topType}|tool_use`;
    }
    const toolRes = segs.find((s) => s && s.type === "tool_result");
    if (toolRes) return `${topType}|tool_result`;
    const thinking = segs.find((s) => s && s.type === "thinking");
    if (thinking) return `${topType}|thinking`;
    const hasText = segs.find((s) => typeof s === "string" || (s && s.type === "text"));
    if (hasText) return `${topType}|message`;
    return `${topType}|entry`;
  })();

  useEffect(() => {
    // In condensed mode, base expansion on categories, then override by manual-open set
    if (!condensed) return;
    const forced = categoryExpanded ? categoryExpanded[catKey] : false;
    let desired = Boolean(forced);
    if (uuid && manualOpenUuids && manualOpenUuids.has(uuid)) desired = true;
    setExpanded(desired);
    // Trigger when cats param changes or manual open set changes
  }, [categoryVersion, manualOpenUuids]);

  // Renderers per segment type
  const rendered = segments.map((seg, i) => {
    if (typeof seg === "string") {
      // Check if this is a /context command output
      if (seg.includes('<local-command-stdout>') && seg.includes('Context Usage')) {
        const cleanedContent = seg
          .replace(/<local-command-stdout>/g, '')
          .replace(/<\/local-command-stdout>/g, '');

        // Parse lines and add colors to Unicode blocks
        const lines = cleanedContent.split('\n');

        return (
          <div
            key={i}
            className="font-mono text-xs bg-gray-950 text-gray-100 p-4 rounded border border-gray-800 overflow-x-auto"
          >
            {lines.map((line, lineIdx) => {
              // Check if line has Unicode blocks
              if (line.includes('⛁') || line.includes('⛀') || line.includes('⛶')) {
                // Parse the line character by character to properly handle ANSI sequences
                let result = '';
                let currentColor = '';
                let i = 0;

                // Map ANSI RGB colors to CSS colors (exact RGB from terminal)
                const colorMap: Record<string, string> = {
                  '38;2;8;145;178': 'rgb(8, 145, 178)', // cyan/blue
                  '38;2;215;119;87': 'rgb(215, 119, 87)', // orange
                  '38;2;136;136;136': 'rgb(136, 136, 136)', // gray
                  '38;2;147;51;234': 'rgb(147, 51, 234)', // purple
                  '38;2;153;153;153': 'rgb(153, 153, 153)', // light gray
                };

                while (i < line.length) {
                  // Check for ANSI escape sequence
                  if (line[i] === '\u001b' && line[i + 1] === '[') {
                    // Find the end of the ANSI sequence
                    let j = i + 2;
                    while (j < line.length && line[j] !== 'm') {
                      j++;
                    }

                    if (j < line.length) {
                      // Extract the ANSI code
                      const ansiCode = line.slice(i + 2, j);

                      // Check if it's a color code we care about
                      if (colorMap[ansiCode]) {
                        currentColor = colorMap[ansiCode];
                      } else if (ansiCode === '39') {
                        // Reset color
                        currentColor = '';
                      }

                      i = j + 1; // Skip past the 'm'
                    } else {
                      i++;
                    }
                  } else {
                    // Regular character
                    const char = line[i];
                    if (char === '⛁' || char === '⛀' || char === '⛶') {
                      // Apply color to Unicode blocks
                      if (currentColor) {
                        result += `<span style="color: ${currentColor}">${char}</span>`;
                      } else {
                        result += char;
                      }
                    } else {
                      result += char;
                    }
                    i++;
                  }
                }

                return (
                  <div
                    key={lineIdx}
                    dangerouslySetInnerHTML={{ __html: result }}
                    className="whitespace-pre"
                  />
                );
              } else {
                // Regular line without blocks
                const withoutAnsi = line.replace(/\u001b\[[0-9;]*m/g, '');
                return (
                  <div key={lineIdx} className="whitespace-pre">
                    {withoutAnsi}
                  </div>
                );
              }
            })}
          </div>
        );
      }
      return <TextOrMarkdown key={i} text={seg} />;
    }
    const t = seg.type as string | undefined;
    if (t === "text") {
      const text = typeof seg.text === "string" ? seg.text : stringifyJson(seg);
      return <TextOrMarkdown key={i} text={text} />;
    }
    if (t === "thinking") {
      // Extract the actual thinking text from the segment
      const thinkingText = seg.thinking || seg.text || "";
      const text = typeof thinkingText === "string" ? thinkingText : stringifyJson(thinkingText);

      return <span key={i}>{text}</span>;
    }
    if (t === "image") {
      const src = seg.source?.type === "base64" ? `data:${seg.source.media_type};base64,${seg.source.data}` : undefined;
      return src ? (
        <div key={i} className="mt-2">
          <img src={src} alt="image" className="block max-w-full h-auto rounded border" />
        </div>
      ) : null;
    }
    if (t === "tool_use") {
      const name = seg.name || "tool";
      // Custom rendering for TodoWrite todos
      const todos = Array.isArray(seg?.input?.todos) ? seg.input.todos : null;
      if (name === "TodoWrite" && todos) {
        const dotClass = (status: string) =>
          status === "completed"
            ? "bg-green-500"
            : status === "in_progress"
              ? "bg-amber-500"
              : "bg-gray-400";
        return (
          <div key={i} className="rounded border border-blue-800 bg-blue-950 p-2 sm:p-3 max-w-full overflow-x-hidden">
            <div className="mb-2 flex flex-wrap items-center gap-2 min-w-0">
              <div className="flex items-center gap-1">
                <span>🔧</span>
                <Pill tone="info">{name}</Pill>
              </div>
            </div>
            <div className="grid gap-1 max-w-full">
              {todos.map((t: any, j: number) => (
                <div key={j} className="flex flex-wrap items-start gap-2 max-w-full">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dotClass(t?.status || "")}`} />
                  <div className="min-w-0 flex-1 max-w-full">
                    <div className="text-sm text-gray-100 break-words break-all">{t?.content || "(no content)"}</div>
                    {t?.activeForm ? (
                      <div className="text-xs text-gray-400 break-words break-all">{t.activeForm}</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Default tool_use rendering
      return (
        <div key={i} className="rounded border border-blue-800 bg-blue-950 p-2 sm:p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span>🔧</span>
              <Pill tone="info">{name}</Pill>
            </div>
          </div>
          {seg.input !== undefined ? (
            <SafePre className="text-blue-200">{stringifyJson(seg.input)}</SafePre>
          ) : null}
        </div>
      );
    }
    if (t === "tool_result") {
      const isErr = Boolean(seg.is_error);
      const contentStr = typeof seg.content === "string" ? seg.content : stringifyJson(seg.content);
      return (
        <div
          key={i}
          className={`rounded border p-2 sm:p-3 ${isErr ? "bg-red-950 border-red-800" : "bg-gray-900 border-gray-700"}`}
        >
          <div className="mb-1 flex items-center gap-2">
            <Pill tone={isErr ? "error" : "default"}>{isErr ? "tool_error" : "tool_result"}</Pill>
            {seg.tool_use_id ? (
              <span className="text-xs text-gray-500 break-all">id: {seg.tool_use_id}</span>
            ) : null}
          </div>
          <SafePre className={isErr ? "text-red-200" : "text-gray-100"}>{contentStr}</SafePre>
        </div>
      );
    }
    // Fallback for unknown segment types
    return (
      <div key={i} className="rounded border border-gray-700 bg-gray-900 p-2 sm:p-3">
        <div className="mb-1"><Pill>unknown-segment</Pill></div>
        <SafePre className="text-gray-200">{stringifyJson(seg)}</SafePre>
      </div>
    );
  });

  // Render compact inline button for condensed mode when not expanded
  if (condensed && !expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          if (onManualToggle) onManualToggle(uuid, next);
        }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-600 bg-black hover:bg-gray-900 transition-colors text-white"
        aria-expanded={expanded}
      >
        <MessageTypeIcon messageKey={summary.key} />
        {summary.isToolUse ? <span className="text-xs font-medium">{summary.label}</span> : null}
        {currentTimestamp && previousTimestamp && summary.key !== 'user|message' ? (
          <span className="text-xs text-gray-500">
            +{formatDuration(new Date(currentTimestamp).getTime() - new Date(previousTimestamp).getTime())}
          </span>
        ) : currentTimestamp ? (
          <span className="text-xs text-gray-500">{new Date(currentTimestamp).toLocaleTimeString()}</span>
        ) : null}
        {topType === "assistant" && v?.message?.usage ? (
          <span className="text-[10px] text-gray-400 inline-flex items-center gap-1">
            <span>
              tok in {v.message.usage.input_tokens ?? "—"} · out {v.message.usage.output_tokens ?? "—"}
            </span>
            {typeof v?.costUSD === "number" ? (
              <>
                <span className="text-gray-600">·</span>
                <span style={{ color: costColorHex(v.costUSD as number, messageCostScale) }}>{formatUSD(v.costUSD)}</span>
              </>
            ) : null}
          </span>
        ) : null}
      </button>
    );
  }

  // Full card for expanded or non-condensed mode
  return (
    <div className="rounded border border-gray-600 bg-black p-2 sm:p-3 w-full text-white">
      {condensed ? (
        <button
          type="button"
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            if (onManualToggle) onManualToggle(uuid, next);
          }}
          className="w-full text-left flex items-center gap-2 min-w-0"
          aria-expanded={expanded}
        >
          <span className="shrink-0 flex items-center gap-1">
            <MessageTypeIcon messageKey={summary.key} />
            {summary.isToolUse ? <Pill tone={summary.tone}>{summary.label}</Pill> : summary.label ? <Pill tone={summary.tone}>{summary.label}</Pill> : null}
          </span>
          {currentTimestamp && previousTimestamp && summary.key !== 'user|message' ? (
            <span className="text-xs text-gray-500 truncate">
              +{formatDuration(new Date(currentTimestamp).getTime() - new Date(previousTimestamp).getTime())}
            </span>
          ) : currentTimestamp ? (
            <span className="text-xs text-gray-500 truncate">{new Date(currentTimestamp).toLocaleTimeString()}</span>
          ) : null}
          {topType === "assistant" && v?.message?.usage ? (
            <span className="text-[11px] text-gray-400 truncate inline-flex items-center gap-1">
              <span>
                tok in {v.message.usage.input_tokens ?? "—"} · out {v.message.usage.output_tokens ?? "—"}
              </span>
              {typeof v?.costUSD === "number" ? (
                <>
                  <span className="text-gray-600">·</span>
                  <span style={{ color: costColorHex(v.costUSD as number, messageCostScale) }}>{formatUSD(v.costUSD)}</span>
                </>
              ) : null}
              <ContextIndicator ctx={(v as any)?.ctxUsage} />
            </span>
          ) : null}
        </button>
      ) : (
        header
      )}

      {!condensed || expanded ? (
        <>
          {!condensed && model ? (
            <div className="mb-2 text-xs text-gray-500 break-all">model: {model}</div>
          ) : null}
          <div className="grid gap-2">{rendered}</div>
          <div className="mt-3">
            <button onClick={() => setShowRaw((s) => !s)} className="text-blue-600 text-xs sm:text-sm hover:underline">
              {showRaw ? "Hide raw" : "Show raw"}
            </button>
            {showRaw ? <SafePre className="mt-2">{stringifyJson(v)}</SafePre> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PromptForm({ onPromptSubmit }: { onPromptSubmit: (text: string) => void }) {
  const fetcher = useFetcher<typeof action>();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("sonnet");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isSubmitting = fetcher.state === "submitting";
  const result = fetcher.data;

  useEffect(() => {
    if (result?.success && fetcher.state === "idle") {
      setPrompt("");
    }
  }, [result, fetcher.state]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;
    const promptText = prompt;
    onPromptSubmit(promptText);
    fetcher.submit({ prompt: promptText, model }, { method: "post" });

    // Fallback: clear this specific prompt after 10 seconds if it's still pending
    setTimeout(() => {
      console.log("[PromptForm] Timeout reached, checking for stale pending prompts");
    }, 10000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="rounded border border-blue-800 bg-blue-950/30 p-4 mb-4">
      <h2 className="text-sm font-semibold text-gray-200 mb-3">Send Prompt to Claude</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="model-select" className="block text-xs text-gray-400 mb-2">
            Model
          </label>
          <select
            id="model-select"
            name="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isSubmitting}
            className="w-full p-2 rounded border border-gray-600 bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="sonnet">Sonnet 4.5 (default - daily use)</option>
            <option value="opus">💎 Opus 4.1 (most powerful)</option>
            <option value="haiku">⚡ Haiku (fastest)</option>
            <option value="sonnet[1m]">Sonnet 4.5 [1M context]</option>
            <option value="opusplan">Opus Plan Mode (hybrid)</option>
            <option value="default">Default (auto-select)</option>
          </select>
        </div>
        <textarea
          ref={textareaRef}
          name="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your prompt... (Cmd+Enter to submit)"
          disabled={isSubmitting}
          className="w-full min-h-24 p-3 rounded border border-gray-600 bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:opacity-50 disabled:cursor-not-allowed"
          rows={3}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            Tip: Press Cmd+Enter to submit
          </div>
          <button
            type="submit"
            disabled={!prompt.trim() || isSubmitting}
            className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Sending..." : "Send to Claude"}
          </button>
        </div>
        {result && fetcher.state === "idle" && !result.success && (
          <div className="mt-3 text-sm text-red-400 border border-red-800 bg-red-950/30 rounded p-3">
            <div className="font-semibold mb-1">Error:</div>
            <div>{result.error || "Failed to send prompt"}</div>
          </div>
        )}
      </form>
    </div>
  );
}
