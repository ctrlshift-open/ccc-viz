/**
 * Server-side utilities for kanban board state management
 */

import { homedir } from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { nanoid } from "nanoid";
import type { KanbanState, KanbanCard, KanbanStatus, CreateCardInput } from "~/types/kanban";
import { createEmptyKanbanState } from "~/types/kanban";
import { getSessionPreview } from "~/sessions.server";
import { getProjects } from "~/projects.server";

/** Path to kanban state file */
function kanbanStatePath(): string {
  return path.join(homedir(), ".claude", "cc-viz", "kanban.json");
}

/** Ensure parent directory exists */
async function ensureDir(): Promise<void> {
  const dir = path.dirname(kanbanStatePath());
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Read kanban state from disk
 * Returns empty state if file doesn't exist
 */
export async function getKanbanState(): Promise<KanbanState> {
  try {
    const content = await fs.readFile(kanbanStatePath(), "utf8");
    const state = JSON.parse(content) as KanbanState;
    // Basic validation
    if (state.version !== 1 || !Array.isArray(state.cards)) {
      return createEmptyKanbanState();
    }
    return state;
  } catch (error) {
    // File doesn't exist or is invalid
    return createEmptyKanbanState();
  }
}

/**
 * Save kanban state to disk
 */
export async function saveKanbanState(state: KanbanState): Promise<void> {
  await ensureDir();
  state.lastSyncedAt = new Date().toISOString();
  await fs.writeFile(kanbanStatePath(), JSON.stringify(state, null, 2), "utf8");
}

/**
 * Generate a title for a card from session data
 * Tries to extract meaningful info from the session
 */
export async function generateTitle(project: string, sessionId: string): Promise<string> {
  try {
    const preview = await getSessionPreview(project, sessionId);
    if (preview) {
      // Use git branch if available
      if (preview.gitBranch) {
        // Clean up branch name for display
        const branch = preview.gitBranch
          .replace(/^(feature|fix|bug|chore|refactor)\//, "")
          .replace(/-/g, " ")
          .replace(/_/g, " ");
        return branch.charAt(0).toUpperCase() + branch.slice(1);
      }
      // Use last message truncated
      if (preview.lastMessage && preview.lastMessage !== "Session in progress") {
        return preview.lastMessage.slice(0, 50) + (preview.lastMessage.length > 50 ? "..." : "");
      }
    }
  } catch {
    // Ignore errors, fall back to session ID
  }
  // Fallback to session ID
  return `Session ${sessionId.slice(0, 8)}`;
}

/**
 * Get all session IDs across all projects
 */
async function getAllSessions(): Promise<Array<{ project: string; sessionId: string; timestamp: string; gitBranch?: string }>> {
  const { projects } = await getProjects();
  const sessions: Array<{ project: string; sessionId: string; timestamp: string; gitBranch?: string }> = [];

  for (const proj of projects) {
    const projectDir = path.join(homedir(), ".claude", "projects", proj.name);
    try {
      const entries = await fs.readdir(projectDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
        const sessionId = entry.name.replace(/\.jsonl$/i, "");
        const filePath = path.join(projectDir, entry.name);
        try {
          const stats = await fs.stat(filePath);
          sessions.push({
            project: proj.name,
            sessionId,
            timestamp: stats.mtime.toISOString(),
          });
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Skip projects we can't read
    }
  }

  return sessions;
}

/**
 * Sync sessions to kanban cards
 * - If no state exists (initial import): all sessions → archive
 * - If state exists: new sessions → in-progress
 */
export async function syncSessionsToCards(): Promise<KanbanState> {
  const existingState = await getKanbanState();
  const isInitialImport = existingState.importedSessionIds.length === 0 && existingState.cards.length === 0;

  const allSessions = await getAllSessions();
  const importedSet = new Set(existingState.importedSessionIds);

  // Find new sessions
  const newSessions = allSessions.filter(s => !importedSet.has(`${s.project}:${s.sessionId}`));

  if (newSessions.length === 0) {
    return existingState;
  }

  // Default status for new cards
  const defaultStatus: KanbanStatus = isInitialImport ? "archive" : "in-progress";

  // Get current max order for the target column
  const existingOrders = existingState.cards
    .filter(c => c.status === defaultStatus)
    .map(c => c.order);
  let nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 0;

  // Create cards for new sessions
  const newCards: KanbanCard[] = [];
  for (const session of newSessions) {
    const title = await generateTitle(session.project, session.sessionId);
    const preview = await getSessionPreview(session.project, session.sessionId);

    newCards.push({
      id: nanoid(10),
      title,
      sessionIds: [session.sessionId],
      project: session.project,
      status: defaultStatus,
      order: nextOrder++,
      gitBranch: preview?.gitBranch,
      createdAt: session.timestamp,
      updatedAt: new Date().toISOString(),
    });
  }

  // Update state
  const updatedState: KanbanState = {
    ...existingState,
    cards: [...existingState.cards, ...newCards],
    importedSessionIds: [
      ...existingState.importedSessionIds,
      ...newSessions.map(s => `${s.project}:${s.sessionId}`),
    ],
    lastSyncedAt: new Date().toISOString(),
  };

  await saveKanbanState(updatedState);
  return updatedState;
}

/**
 * Create a card from input
 */
export function createCard(input: CreateCardInput, state: KanbanState): KanbanCard {
  // Get max order for in-progress column (default for new cards)
  const inProgressCards = state.cards.filter(c => c.status === "in-progress");
  const maxOrder = inProgressCards.length > 0
    ? Math.max(...inProgressCards.map(c => c.order))
    : -1;

  return {
    id: nanoid(10),
    title: input.title || `Session ${input.sessionId.slice(0, 8)}`,
    sessionIds: [input.sessionId],
    project: input.project,
    status: "in-progress",
    order: maxOrder + 1,
    gitBranch: input.gitBranch,
    createdAt: input.timestamp || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update a card's status and reorder within column
 */
export function updateCardStatus(
  state: KanbanState,
  cardId: string,
  newStatus: KanbanStatus,
  newOrder?: number
): KanbanState {
  const cardIndex = state.cards.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return state;

  const card = state.cards[cardIndex];
  const oldStatus = card.status;

  // If status changed, need to reorder both columns
  if (oldStatus !== newStatus) {
    // Remove from old column - decrement orders of cards that were after this one
    const updatedCards = state.cards.map(c => {
      if (c.status === oldStatus && c.order > card.order) {
        return { ...c, order: c.order - 1 };
      }
      return c;
    });

    // Add to new column at specified position or end
    const newColumnCards = updatedCards.filter(c => c.status === newStatus);
    const targetOrder = newOrder ?? (newColumnCards.length > 0 ? Math.max(...newColumnCards.map(c => c.order)) + 1 : 0);

    // Shift cards in new column to make room
    const finalCards = updatedCards.map(c => {
      if (c.id === cardId) {
        return { ...c, status: newStatus, order: targetOrder, updatedAt: new Date().toISOString() };
      }
      if (c.status === newStatus && c.order >= targetOrder) {
        return { ...c, order: c.order + 1 };
      }
      return c;
    });

    return { ...state, cards: finalCards };
  }

  // Same column, just reorder
  if (newOrder !== undefined && newOrder !== card.order) {
    const columnCards = state.cards.filter(c => c.status === oldStatus && c.id !== cardId);
    columnCards.splice(newOrder, 0, { ...card, order: newOrder, updatedAt: new Date().toISOString() });

    // Renumber all cards in column
    const reorderedCards = columnCards.map((c, i) => ({ ...c, order: i }));
    const otherCards = state.cards.filter(c => c.status !== oldStatus);

    return { ...state, cards: [...otherCards, ...reorderedCards] };
  }

  return state;
}

/**
 * Merge two cards - combine sessionIds, delete source
 */
export function mergeCards(
  state: KanbanState,
  sourceId: string,
  targetId: string
): KanbanState {
  const sourceCard = state.cards.find(c => c.id === sourceId);
  const targetCard = state.cards.find(c => c.id === targetId);

  if (!sourceCard || !targetCard) return state;

  // Combine sessionIds
  const mergedSessionIds = [...targetCard.sessionIds, ...sourceCard.sessionIds];

  // Update target card
  const updatedCards = state.cards
    .filter(c => c.id !== sourceId) // Remove source
    .map(c => {
      if (c.id === targetId) {
        return {
          ...c,
          sessionIds: mergedSessionIds,
          updatedAt: new Date().toISOString(),
        };
      }
      // Decrement order for cards after source in same column
      if (c.status === sourceCard.status && c.order > sourceCard.order) {
        return { ...c, order: c.order - 1 };
      }
      return c;
    });

  return { ...state, cards: updatedCards };
}
