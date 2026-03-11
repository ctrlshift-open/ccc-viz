/**
 * Client hook for subscribing to session file watcher events
 * Connects to SSE endpoint and fires callbacks on session changes
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { WatcherEvent, SessionAddedEvent } from "~/utils/watcher-types";

export type { SessionAddedEvent };

export type SessionWatcherOptions = {
  /** Called when a new session is detected */
  onSessionAdded?: (event: Extract<WatcherEvent, { type: "session:added" }>) => void;
  /** Called when a session file changes */
  onSessionChanged?: (event: Extract<WatcherEvent, { type: "session:changed" }>) => void;
  /** Called when a session is deleted */
  onSessionRemoved?: (event: Extract<WatcherEvent, { type: "session:removed" }>) => void;
  /** Called when watcher is ready */
  onReady?: () => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Whether to enable the watcher (default: true) */
  enabled?: boolean;
};

export type SessionWatcherState = {
  /** Whether connected to SSE stream */
  connected: boolean;
  /** Whether watcher is ready */
  ready: boolean;
  /** Last error if any */
  error: string | null;
};

/**
 * Hook to subscribe to session file watcher events via SSE
 */
export function useSessionWatcher(options: SessionWatcherOptions = {}): SessionWatcherState {
  const {
    onSessionAdded,
    onSessionChanged,
    onSessionRemoved,
    onReady,
    onError,
    enabled = true,
  } = options;

  const [state, setState] = useState<SessionWatcherState>({
    connected: false,
    ready: false,
    error: null,
  });

  // Use refs for callbacks to avoid reconnecting on callback changes
  const callbacksRef = useRef({
    onSessionAdded,
    onSessionChanged,
    onSessionRemoved,
    onReady,
    onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSessionAdded,
      onSessionChanged,
      onSessionRemoved,
      onReady,
      onError,
    };
  }, [onSessionAdded, onSessionChanged, onSessionRemoved, onReady, onError]);

  useEffect(() => {
    if (!enabled) {
      setState({ connected: false, ready: false, error: null });
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      eventSource = new EventSource("/api/kanban/watch");

      eventSource.onopen = () => {
        setState((prev) => ({ ...prev, connected: true, error: null }));
      };

      eventSource.onerror = () => {
        setState((prev) => ({ ...prev, connected: false, ready: false }));
        // EventSource will auto-reconnect, but we can track the error
        callbacksRef.current.onError?.("Connection lost, reconnecting...");
      };

      // Handle ready event
      eventSource.addEventListener("ready", () => {
        setState((prev) => ({ ...prev, ready: true }));
        callbacksRef.current.onReady?.();
      });

      // Handle watcher:ready event
      eventSource.addEventListener("watcher:ready", () => {
        setState((prev) => ({ ...prev, ready: true }));
        callbacksRef.current.onReady?.();
      });

      // Handle session events
      eventSource.addEventListener("session:added", (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data);
          callbacksRef.current.onSessionAdded?.(event);
        } catch (err) {
          console.error("[useSessionWatcher] Parse error:", err);
        }
      });

      eventSource.addEventListener("session:changed", (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data);
          callbacksRef.current.onSessionChanged?.(event);
        } catch (err) {
          console.error("[useSessionWatcher] Parse error:", err);
        }
      });

      eventSource.addEventListener("session:removed", (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data);
          callbacksRef.current.onSessionRemoved?.(event);
        } catch (err) {
          console.error("[useSessionWatcher] Parse error:", err);
        }
      });

      // Handle watcher error events
      eventSource.addEventListener("watcher:error", (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data);
          setState((prev) => ({ ...prev, error: event.error }));
          callbacksRef.current.onError?.(event.error);
        } catch (err) {
          console.error("[useSessionWatcher] Parse error:", err);
        }
      });

      // Ping events are just keepalive, no action needed
      eventSource.addEventListener("ping", () => {
        // Keepalive - nothing to do
      });
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [enabled]);

  return state;
}
