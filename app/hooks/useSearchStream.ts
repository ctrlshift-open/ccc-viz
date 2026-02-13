import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchFilters, SearchResult } from "~/types/search";

export type SearchStreamState = {
  results: SearchResult[];
  isSearching: boolean;
  isDone: boolean;
  error: string | null;
  progress: { scanned: number; total: number } | null;
  truncated: boolean;
};

function buildSearchUrl(filters: SearchFilters): string {
  const params = new URLSearchParams();
  params.set("q", filters.query);
  if (filters.daysBack != null) params.set("days", String(filters.daysBack));
  if (filters.projects.length) params.set("projects", filters.projects.join(","));
  if (filters.messageTypes.length) params.set("types", filters.messageTypes.join(","));
  if (filters.models.length) params.set("models", filters.models.join(","));
  if (filters.includeToolContent) params.set("toolContent", "1");
  return `/api/search/stream?${params.toString()}`;
}

export function useSearchStream() {
  const [state, setState] = useState<SearchStreamState>({
    results: [],
    isSearching: false,
    isDone: false,
    error: null,
    progress: null,
    truncated: false,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const search = useCallback(
    (filters: SearchFilters) => {
      // Close previous stream
      close();

      if (!filters.query.trim()) {
        setState({
          results: [],
          isSearching: false,
          isDone: false,
          error: null,
          progress: null,
          truncated: false,
        });
        return;
      }

      setState({
        results: [],
        isSearching: true,
        isDone: false,
        error: null,
        progress: null,
        truncated: false,
      });

      const url = buildSearchUrl(filters);
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("result", (e: MessageEvent) => {
        try {
          const result: SearchResult = JSON.parse(e.data);
          setState((prev) => ({
            ...prev,
            results: [...prev.results, result],
          }));
        } catch {}
      });

      es.addEventListener("progress", (e: MessageEvent) => {
        try {
          const progress = JSON.parse(e.data);
          setState((prev) => ({ ...prev, progress }));
        } catch {}
      });

      es.addEventListener("done", () => {
        setState((prev) => ({
          ...prev,
          isSearching: false,
          isDone: true,
        }));
        es.close();
        eventSourceRef.current = null;
      });

      es.addEventListener("truncated", () => {
        setState((prev) => ({ ...prev, truncated: true }));
      });

      es.addEventListener("error", (e: any) => {
        // EventSource fires generic error events on close; only surface real ones
        if (es.readyState === EventSource.CLOSED) {
          setState((prev) => ({
            ...prev,
            isSearching: false,
            isDone: true,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isSearching: false,
            error: "Search connection lost",
          }));
        }
        es.close();
        eventSourceRef.current = null;
      });
    },
    [close]
  );

  // Cleanup on unmount
  useEffect(() => close, [close]);

  return { ...state, search, close };
}
