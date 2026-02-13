import { homedir } from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { classifyMessage, extractSearchableText } from "~/utils/classify-message";
import type { SearchFilters, SearchResult } from "~/types/search";

type CandidateFile = {
  project: string;
  sessionId: string;
  filePath: string;
  mtime: number;
};

const MAX_RESULTS = 500;
const SNIPPET_RADIUS = 100;
const CONCURRENCY = 4;

/** Get candidate .jsonl files, pre-filtered by project and date */
export async function getCandidateFiles(
  filters: SearchFilters
): Promise<CandidateFile[]> {
  const dir = path.join(homedir(), ".claude", "projects");
  const candidates: CandidateFile[] = [];

  const cutoff =
    filters.daysBack != null
      ? Date.now() - filters.daysBack * 24 * 60 * 60 * 1000
      : 0;

  let projectDirs: string[];
  if (filters.projects.length > 0) {
    projectDirs = filters.projects;
  } else {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      projectDirs = entries
        .filter((e) => e.isDirectory() && e.name !== "." && e.name !== "..")
        .map((e) => e.name);
    } catch {
      return [];
    }
  }

  await Promise.all(
    projectDirs.map(async (projectName) => {
      const projectDir = path.join(dir, projectName);
      let files: string[];
      try {
        files = await fs.readdir(projectDir);
      } catch {
        return;
      }
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        const filePath = path.join(projectDir, file);
        try {
          const stat = await fs.stat(filePath);
          if (cutoff > 0 && stat.mtime.getTime() < cutoff) continue;
          candidates.push({
            project: projectName,
            sessionId: file.replace(/\.jsonl$/, ""),
            filePath,
            mtime: stat.mtime.getTime(),
          });
        } catch {
          // skip unreadable files
        }
      }
    })
  );

  // newest first
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates;
}

function buildSnippet(
  text: string,
  matchIdx: number,
  queryLen: number
): { snippet: string; matchStart: number } {
  const start = Math.max(0, matchIdx - SNIPPET_RADIUS);
  const end = Math.min(text.length, matchIdx + queryLen + SNIPPET_RADIUS);
  let snippet = text.slice(start, end);

  // replace newlines with spaces for display
  snippet = snippet.replace(/\n/g, " ");

  const matchStart = matchIdx - start;
  return { snippet, matchStart };
}

/** Search sessions, yielding results as found. */
export async function* searchSessions(
  filters: SearchFilters,
  signal?: AbortSignal
): AsyncGenerator<
  | { type: "result"; data: SearchResult }
  | { type: "progress"; scanned: number; total: number }
> {
  const candidates = await getCandidateFiles(filters);
  const total = candidates.length;
  const queryLower = filters.query.toLowerCase();
  const typeFilter =
    filters.messageTypes.length > 0
      ? new Set(filters.messageTypes)
      : null;
  const modelFilter =
    filters.models.length > 0 ? new Set(filters.models) : null;

  let scanned = 0;
  let resultCount = 0;

  // Process files with bounded concurrency
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    if (signal?.aborted || resultCount >= MAX_RESULTS) break;

    const batch = candidates.slice(i, i + CONCURRENCY);
    const batchResults: SearchResult[] = [];

    await Promise.all(
      batch.map(async (candidate) => {
        if (signal?.aborted || resultCount + batchResults.length >= MAX_RESULTS)
          return;

        let content: string;
        try {
          content = await fs.readFile(candidate.filePath, "utf8");
        } catch {
          return;
        }

        const lines = content.split("\n");
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          if (
            signal?.aborted ||
            resultCount + batchResults.length >= MAX_RESULTS
          )
            break;

          const line = lines[lineIdx];
          if (!line.trim()) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(line);
          } catch {
            continue;
          }

          // classify and check type filter
          const msgType = classifyMessage(parsed);
          if (typeFilter && !typeFilter.has(msgType)) continue;

          // check model filter
          const model: string | undefined = parsed?.message?.model;
          if (modelFilter) {
            if (!model) continue;
            const modelLower = model.toLowerCase();
            let matches = false;
            for (const m of modelFilter) {
              if (modelLower.includes(m)) {
                matches = true;
                break;
              }
            }
            if (!matches) continue;
          }

          // extract text and search
          const text = extractSearchableText(
            parsed,
            filters.includeToolContent
          );
          if (!text) continue;

          const matchIdx = text.toLowerCase().indexOf(queryLower);
          if (matchIdx === -1) continue;

          const { snippet, matchStart } = buildSnippet(
            text,
            matchIdx,
            filters.query.length
          );

          batchResults.push({
            project: candidate.project,
            sessionId: candidate.sessionId,
            lineIndex: lineIdx,
            timestamp: parsed?.timestamp || "",
            messageType: msgType,
            model,
            snippet,
            matchStart,
            matchLength: filters.query.length,
          });
        }
      })
    );

    for (const result of batchResults) {
      if (resultCount >= MAX_RESULTS) break;
      resultCount++;
      yield { type: "result", data: result };
    }

    scanned += batch.length;
    yield { type: "progress", scanned, total };
  }
}
