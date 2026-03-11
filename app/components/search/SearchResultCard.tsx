import { Link } from "react-router";
import type { SearchResult } from "~/types/search";
import { getModelEmoji } from "~/utils/models";
import { classifyLabel } from "~/utils/classify-message";

function SnippetWithHighlight({
  snippet,
  matchStart,
  matchLength,
}: {
  snippet: string;
  matchStart: number;
  matchLength: number;
}) {
  const before = snippet.slice(0, matchStart);
  const match = snippet.slice(matchStart, matchStart + matchLength);
  const after = snippet.slice(matchStart + matchLength);
  return (
    <span className="font-mono text-xs text-gray-300 whitespace-pre-wrap break-all">
      {before}
      <mark className="bg-yellow-600/60 text-yellow-100 rounded-sm px-0.5">
        {match}
      </mark>
      {after}
    </span>
  );
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function SearchResultCard({ result }: { result: SearchResult }) {
  const emoji = getModelEmoji(result.model);
  const typeLabel = classifyLabel(result.messageType);

  return (
    <div className="border border-gray-700 rounded-lg hover:border-gray-600 p-3 transition-colors">
      <div className="mb-2">
        <SnippetWithHighlight
          snippet={result.snippet}
          matchStart={result.matchStart}
          matchLength={result.matchLength}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
        <Link
          to={`/${encodeURIComponent(result.project)}/sessions`}
          className="text-blue-400 hover:underline"
        >
          {result.project.length > 30
            ? "..." + result.project.slice(-27)
            : result.project}
        </Link>
        <span className="text-gray-600">/</span>
        <Link
          to={`/${encodeURIComponent(result.project)}/sessions/${result.sessionId}`}
          className="text-blue-400 hover:underline"
        >
          {result.sessionId.slice(0, 8)}...
        </Link>
        {result.timestamp && (
          <span>{formatTimestamp(result.timestamp)}</span>
        )}
        <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
          {typeLabel}
        </span>
        {emoji && <span title={result.model}>{emoji}</span>}
      </div>
    </div>
  );
}
