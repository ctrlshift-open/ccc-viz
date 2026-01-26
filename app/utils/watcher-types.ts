/**
 * Event types for the session file watcher
 */

/** Event fired when a new session file is detected */
export type SessionAddedEvent = {
  type: "session:added";
  /** Full path to the .jsonl file */
  path: string;
  /** Session ID (filename without .jsonl) */
  sessionId: string;
  /** Project path (relative to ~/.claude/projects) */
  project: string;
};

/** Event fired when an existing session file changes */
export type SessionChangedEvent = {
  type: "session:changed";
  path: string;
  sessionId: string;
  project: string;
};

/** Event fired when a session file is deleted */
export type SessionRemovedEvent = {
  type: "session:removed";
  path: string;
  sessionId: string;
  project: string;
};

/** Event fired when watcher encounters an error */
export type WatcherErrorEvent = {
  type: "watcher:error";
  error: string;
};

/** Event fired when watcher is ready */
export type WatcherReadyEvent = {
  type: "watcher:ready";
};

/** Union of all watcher events */
export type WatcherEvent =
  | SessionAddedEvent
  | SessionChangedEvent
  | SessionRemovedEvent
  | WatcherErrorEvent
  | WatcherReadyEvent;

/** Event type discriminators for type narrowing */
export type WatcherEventType = WatcherEvent["type"];

/** Parse session info from a .jsonl file path */
export function parseSessionPath(filePath: string): {
  sessionId: string;
  project: string;
} | null {
  // Path format: ~/.claude/projects/{project}/sessions/{sessionId}.jsonl
  const match = filePath.match(
    /\.claude\/projects\/([^/]+)\/sessions\/([^/]+)\.jsonl$/
  );
  if (!match) return null;
  return {
    project: match[1],
    sessionId: match[2],
  };
}
