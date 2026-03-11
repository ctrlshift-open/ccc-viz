export type SearchFilters = {
  query: string;
  daysBack: number | null; // null = all time
  projects: string[]; // empty = all projects
  messageTypes: string[]; // e.g. ["assistant|message"]
  models: string[]; // e.g. ["opus", "sonnet"]
  includeToolContent: boolean; // default false
};

export type SearchResult = {
  project: string;
  sessionId: string;
  lineIndex: number;
  timestamp: string;
  messageType: string;
  model: string | undefined;
  snippet: string; // ~100 chars before + match + ~100 chars after
  matchStart: number; // offset within snippet
  matchLength: number;
};

export const DAYS_OPTIONS = [
  { value: null, label: "All time" },
  { value: 1, label: "Last 24 hours" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
] as const;

export const MESSAGE_TYPE_OPTIONS = [
  { value: "assistant|message", label: "Assistant messages" },
  { value: "assistant|thinking", label: "Thinking" },
  { value: "user|message", label: "User messages" },
  { value: "assistant|tool_use", label: "Tool use" },
  { value: "user|tool_result", label: "Tool results" },
  { value: "summary", label: "Summaries" },
] as const;

export const MODEL_FILTER_OPTIONS = [
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "haiku", label: "Haiku" },
] as const;
