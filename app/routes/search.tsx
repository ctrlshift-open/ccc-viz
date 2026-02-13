import { useLoaderData } from "react-router";
import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchStream } from "~/hooks/useSearchStream";
import { ProjectMultiSelect } from "~/components/search/ProjectMultiSelect";
import { SearchResultCard } from "~/components/search/SearchResultCard";
import type { SearchFilters } from "~/types/search";
import {
  DAYS_OPTIONS,
  MESSAGE_TYPE_OPTIONS,
  MODEL_FILTER_OPTIONS,
} from "~/types/search";

export function meta() {
  return [
    { title: "Search - CC Viz" },
    { name: "description", content: "Search across Claude Code sessions" },
  ];
}

export async function loader() {
  const { getProjectNames } = await import("~/projects.server");
  return { projects: await getProjectNames() };
}

export default function SearchPage() {
  const { projects } = useLoaderData<typeof loader>();

  const [query, setQuery] = useState("");
  const [daysBack, setDaysBack] = useState<number | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [messageTypes, setMessageTypes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [includeToolContent, setIncludeToolContent] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stream = useSearchStream();

  const doSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        stream.close();
        return;
      }
      const filters: SearchFilters = {
        query: q,
        daysBack,
        projects: selectedProjects,
        messageTypes,
        models,
        includeToolContent,
      };
      stream.search(filters);
    },
    [daysBack, selectedProjects, messageTypes, models, includeToolContent, stream]
  );

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(query);
  };

  // Re-search when filters change (if query exists)
  useEffect(() => {
    if (query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(query), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysBack, selectedProjects, messageTypes, models, includeToolContent]);

  const toggleMessageType = (type: string) => {
    setMessageTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleModel = (model: string) => {
    setModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  const activeFilterCount =
    (daysBack != null ? 1 : 0) +
    (selectedProjects.length > 0 ? 1 : 0) +
    (messageTypes.length > 0 ? 1 : 0) +
    (models.length > 0 ? 1 : 0) +
    (includeToolContent ? 1 : 0);

  return (
    <main className="p-4 pt-16 md:pt-14 max-w-screen-xl mx-auto">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Filters — sidebar on desktop, collapsible on mobile */}
        <aside className="md:w-72 shrink-0">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="md:hidden w-full flex items-center justify-between px-3 py-2 mb-2 rounded-lg bg-gray-800 text-gray-200 text-sm"
            type="button"
          >
            <span>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div className={`space-y-4 ${filtersOpen ? "" : "hidden md:block"}`}>
            {/* Days filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Time range
              </label>
              <select
                value={daysBack ?? ""}
                onChange={(e) =>
                  setDaysBack(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full px-2 py-1.5 text-sm rounded-lg bg-gray-800 border border-gray-600 text-gray-200"
              >
                {DAYS_OPTIONS.map((opt) => (
                  <option key={String(opt.value)} value={opt.value ?? ""}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Project filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Projects
              </label>
              <ProjectMultiSelect
                projects={projects}
                selected={selectedProjects}
                onChange={setSelectedProjects}
              />
            </div>

            {/* Message type filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Message types
              </label>
              <div className="space-y-1">
                {MESSAGE_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={messageTypes.includes(opt.value)}
                      onChange={() => toggleMessageType(opt.value)}
                      className="rounded border-gray-600"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Model filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Models
              </label>
              <div className="space-y-1">
                {MODEL_FILTER_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={models.includes(opt.value)}
                      onChange={() => toggleModel(opt.value)}
                      className="rounded border-gray-600"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Include tool content */}
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeToolContent}
                onChange={(e) => setIncludeToolContent(e.target.checked)}
                className="rounded border-gray-600"
              />
              Include tool content
            </label>
          </div>
        </aside>

        {/* Search + results */}
        <div className="flex-1 min-w-0">
          {/* Search input */}
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Search across all sessions..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-gray-800 border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* Progress bar */}
          {stream.isSearching && stream.progress && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>
                  Scanning files... {stream.progress.scanned}/
                  {stream.progress.total}
                </span>
                <span>{stream.results.length} results</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.round(
                      (stream.progress.scanned / stream.progress.total) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Status line */}
          {stream.isDone && (
            <p className="text-sm text-gray-400 mb-3">
              {stream.results.length} result{stream.results.length !== 1 ? "s" : ""} found
              {stream.truncated && " (capped at 500)"}
            </p>
          )}

          {stream.error && (
            <p className="text-sm text-red-400 mb-3">{stream.error}</p>
          )}

          {/* Results list */}
          <div className="space-y-2">
            {stream.results.map((r, i) => (
              <SearchResultCard key={`${r.sessionId}-${r.lineIndex}-${i}`} result={r} />
            ))}
          </div>

          {stream.isSearching && stream.results.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              Searching...
            </div>
          )}

          {!stream.isSearching &&
            !stream.isDone &&
            stream.results.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                Enter a search term to search across all session content
              </div>
            )}
        </div>
      </div>
    </main>
  );
}
