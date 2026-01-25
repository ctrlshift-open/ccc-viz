/**
 * Kanban board types for organizing Claude Code sessions
 */

/** Kanban column statuses */
export type KanbanStatus = "archive" | "back-log" | "in-progress" | "discard" | "complete";

/** Column display order */
export const KANBAN_COLUMNS: KanbanStatus[] = [
  "archive",
  "back-log",
  "in-progress",
  "discard",
  "complete",
];

/** Column display labels */
export const KANBAN_LABELS: Record<KanbanStatus, string> = {
  archive: "Archive",
  "back-log": "Backlog",
  "in-progress": "In Progress",
  discard: "Discard",
  complete: "Complete",
};

/** A kanban card representing one or more sessions */
export type KanbanCard = {
  id: string;
  title: string;
  /** Session IDs - can have multiple if merged */
  sessionIds: string[];
  /** Project name from ~/.claude/projects */
  project: string;
  status: KanbanStatus;
  /** Position within column for ordering */
  order: number;
  /** Git branch from session (first session if merged) */
  gitBranch?: string;
  /** Original timestamp from session */
  createdAt: string;
  /** Last modification time */
  updatedAt: string;
  /** Title generation version - used to track AI-generated titles */
  version?: number;
};

/** Full kanban state stored in ~/.claude/cc-viz/kanban.json */
export type KanbanState = {
  version: 1;
  cards: KanbanCard[];
  /** Track which sessions we've already imported */
  importedSessionIds: string[];
  /** Last sync timestamp */
  lastSyncedAt: string;
};

/** Input for creating a new card */
export type CreateCardInput = {
  sessionId: string;
  project: string;
  title?: string;
  gitBranch?: string;
  timestamp?: string;
};

/** Input for updating a card */
export type UpdateCardInput = {
  id: string;
  title?: string;
  status?: KanbanStatus;
  order?: number;
};

/** Input for merging cards */
export type MergeCardsInput = {
  sourceId: string;
  targetId: string;
};

/** Empty initial state factory */
export function createEmptyKanbanState(): KanbanState {
  return {
    version: 1,
    cards: [],
    importedSessionIds: [],
    lastSyncedAt: new Date().toISOString(),
  };
}
