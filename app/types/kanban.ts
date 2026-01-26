/**
 * Kanban board types for organizing Claude Code sessions by story (project + branch)
 */

/** Kanban column statuses */
export type KanbanStatus = "archive" | "back-log" | "in-progress" | "discard" | "complete";

/** Column display order (all statuses for internal use) */
export const KANBAN_COLUMNS: KanbanStatus[] = [
  "archive",
  "back-log",
  "in-progress",
  "discard",
  "complete",
];

/** Columns to display on the kanban board (excludes archive) */
export const KANBAN_DISPLAY_COLUMNS: KanbanStatus[] = [
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

/** A session within a story */
export type StorySession = {
  /** Session ID (filename without .jsonl) */
  id: string;
  /** AI-generated name summarizing the session */
  name: string;
  /** Session creation timestamp */
  timestamp: string;
  /** URL to session browser view */
  link: string;
};

/** A kanban story = project + branch combination */
export type KanbanStory = {
  id: string;
  /** Title - defaults to branch name, user-editable */
  title: string;
  /** Project name from ~/.claude/projects */
  project: string;
  /** Git branch name, null for "No Branch" story */
  branch: string | null;
  /** GitHub PR URL (auto-detected or manual) */
  prLink: string | null;
  status: KanbanStatus;
  /** Position within column for ordering */
  order: number;
  /** Sessions belonging to this story */
  sessions: StorySession[];
  /** Story creation timestamp */
  createdAt: string;
  /** Last modification time */
  updatedAt: string;
};

/** Full kanban state stored in ~/.claude/cc-viz/kanban.json */
export type KanbanState = {
  /** Version 2 = story-based model */
  version: 2;
  stories: KanbanStory[];
  /** Last sync timestamp */
  lastSyncedAt: string;
};

/** Input for updating a story */
export type UpdateStoryInput = {
  id: string;
  title?: string;
  status?: KanbanStatus;
  order?: number;
  prLink?: string | null;
};

/** Empty initial state factory */
export function createEmptyKanbanState(): KanbanState {
  return {
    version: 2,
    stories: [],
    lastSyncedAt: new Date().toISOString(),
  };
}
