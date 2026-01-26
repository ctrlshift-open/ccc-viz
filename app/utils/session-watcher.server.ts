/**
 * Singleton file watcher for Claude Code session files
 * Watches for changes to .jsonl session files
 */

import { homedir } from "node:os";
import * as path from "node:path";
import type chokidar from "chokidar";
import type { WatcherEvent } from "./watcher-types";
import { parseSessionPath } from "./watcher-types";

type EventCallback = (event: WatcherEvent) => void;

let watcher: any = null;
const subscribers = new Set<EventCallback>();

/**
 * Get the path to watch for session files
 */
function getWatchPath(): string {
  return path.join(homedir(), ".claude", "projects");
}

/**
 * Create a watcher event from a file path and event type
 */
function createEvent(
  type: "session:added" | "session:changed" | "session:removed",
  filePath: string
): WatcherEvent | null {
  const parsed = parseSessionPath(filePath);
  if (!parsed) return null;

  return {
    type,
    path: filePath,
    sessionId: parsed.sessionId,
    project: parsed.project,
  };
}

/**
 * Notify all subscribers of an event
 */
function notifySubscribers(event: WatcherEvent): void {
  for (const callback of subscribers) {
    try {
      callback(event);
    } catch (error) {
      console.error("[session-watcher] Subscriber error:", error);
    }
  }
}

/**
 * Initialize the file watcher singleton
 * Called on first subscription
 */
function initWatcher(): void {
  if (watcher) return;

  const watchPath = getWatchPath();
  console.log(`[session-watcher] Starting watcher on ${watchPath}`);

  const chokidarModule = require("chokidar");
  watcher = chokidarModule.watch(watchPath, {
    // Watch for .jsonl files in any project directory
    ignored: (filePath: string, stats: any) => {
      // Allow directories for traversal
      if (stats?.isDirectory()) return false;
      // Only watch .jsonl files
      return !filePath.endsWith(".jsonl");
    },
    persistent: true,
    ignoreInitial: true, // Don't emit events for existing files
    awaitWriteFinish: {
      stabilityThreshold: 500, // Wait 500ms after last write
      pollInterval: 100,
    },
    depth: 3, // projects/{project}/sessions/{file}.jsonl = 3 levels
  });

  watcher.on("add", (filePath: string) => {
    const event = createEvent("session:added", filePath);
    if (event && event.type === "session:added") {
      console.log(`[session-watcher] Session added: ${event.sessionId}`);
      notifySubscribers(event);
    }
  });

  watcher.on("change", (filePath: string) => {
    const event = createEvent("session:changed", filePath);
    if (event) {
      notifySubscribers(event);
    }
  });

  watcher.on("unlink", (filePath: string) => {
    const event = createEvent("session:removed", filePath);
    if (event && event.type === "session:removed") {
      console.log(`[session-watcher] Session removed: ${event.sessionId}`);
      notifySubscribers(event);
    }
  });

  watcher.on("error", (error: any) => {
    console.error("[session-watcher] Watcher error:", error);
    notifySubscribers({
      type: "watcher:error",
      error: String(error),
    });
  });

  watcher.on("ready", () => {
    console.log("[session-watcher] Watcher ready");
    notifySubscribers({ type: "watcher:ready" });
  });
}

/**
 * Subscribe to watcher events
 * Automatically starts the watcher on first subscriber
 * @returns Unsubscribe function
 */
export function subscribe(callback: EventCallback): () => void {
  // Start watcher on first subscriber
  if (subscribers.size === 0) {
    initWatcher();
  }

  subscribers.add(callback);

  return () => {
    subscribers.delete(callback);

    // Stop watcher when no subscribers remain
    if (subscribers.size === 0 && watcher) {
      console.log("[session-watcher] No subscribers, closing watcher");
      watcher.close();
      watcher = null;
    }
  };
}

/**
 * Check if the watcher is currently running
 */
export function isWatching(): boolean {
  return watcher !== null;
}

/**
 * Get subscriber count (for debugging)
 */
export function getSubscriberCount(): number {
  return subscribers.size;
}
