/**
 * Server-side utilities for kanban board state management
 */

import { homedir, tmpdir } from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { nanoid } from "nanoid";
import type { KanbanState, KanbanCard, KanbanStatus, CreateCardInput } from "~/types/kanban";
import { createEmptyKanbanState } from "~/types/kanban";
import { getSessionPreview } from "~/sessions.server";
import { getProjects } from "~/projects.server";
import { resolveSessionFile } from "~/utils/path-safety.server";

const execAsync = promisify(exec);

/** Path to kanban state file (active cards) */
function kanbanStatePath(): string {
  return path.join(homedir(), ".claude", "cc-viz", "kanban.json");
}

/** Path to kanban archive file (archived cards) */
function kanbanArchivePath(): string {
  return path.join(homedir(), ".claude", "cc-viz", "kanban-archive.json");
}

/** Ensure parent directory exists */
async function ensureDir(): Promise<void> {
  const dir = path.dirname(kanbanStatePath());
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Check if a session was started with haiku model
 * Returns true if the first assistant message used haiku
 */
export async function isHaikuSession(project: string, sessionId: string): Promise<boolean> {
  const { file } = resolveSessionFile(project, sessionId);

  try {
    const content = await fs.readFile(file, "utf8");
    const lines = content.split(/\r?\n/).filter((l) => l.length > 0);

    // Check first 50 lines for an assistant message with model info
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      try {
        const parsed = JSON.parse(lines[i]);
        if (parsed.type === "assistant" && parsed.message?.model) {
          return parsed.message.model.toLowerCase().includes("haiku");
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Extract first/last user and assistant messages from a session file
 * Returns content suitable for AI title generation
 */
export async function extractSessionContent(project: string, sessionId: string): Promise<string | null> {
  const { file } = resolveSessionFile(project, sessionId);

  try {
    const content = await fs.readFile(file, "utf8");
    const lines = content.split(/\r?\n/).filter((l) => l.length > 0);

    const userMessages: string[] = [];
    const assistantMessages: string[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);

        // Extract user messages
        if (parsed.type === "user" && parsed.message) {
          const msgContent = parsed.message.content;
          let text = "";
          if (Array.isArray(msgContent)) {
            const textItem = msgContent.find(c => typeof c === "string" || c.type === "text");
            text = typeof textItem === "string" ? textItem : textItem?.text || "";
          } else if (typeof msgContent === "string") {
            text = msgContent;
          }
          // Skip commands
          if (text && !text.startsWith("/")) {
            userMessages.push(text.slice(0, 500));
          }
        }

        // Extract assistant messages
        if (parsed.type === "assistant" && parsed.message) {
          const msgContent = parsed.message.content;
          if (Array.isArray(msgContent)) {
            const textItem = msgContent.find(c => c.type === "text");
            if (textItem?.text) {
              assistantMessages.push(textItem.text.slice(0, 500));
            }
          } else if (typeof msgContent === "string") {
            assistantMessages.push(msgContent.slice(0, 500));
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    if (userMessages.length === 0 && assistantMessages.length === 0) {
      return null;
    }

    // Build context with first and last messages
    const parts: string[] = [];

    if (userMessages.length > 0) {
      parts.push(`First user message:\n${userMessages[0]}`);
      if (userMessages.length > 1) {
        parts.push(`Last user message:\n${userMessages[userMessages.length - 1]}`);
      }
    }

    if (assistantMessages.length > 0) {
      parts.push(`First assistant response:\n${assistantMessages[0]}`);
      if (assistantMessages.length > 1) {
        parts.push(`Last assistant response:\n${assistantMessages[assistantMessages.length - 1]}`);
      }
    }

    return parts.join("\n\n---\n\n");
  } catch {
    return null;
  }
}

/**
 * Generate AI title using Claude CLI with haiku model
 * @param contentFilePath Path to temp file with session content
 * @returns Generated title or null on failure
 */
export async function generateAITitle(contentFilePath: string): Promise<string | null> {
  const systemPrompt = "Output only the requested text. No explanations, questions, or formatting.";
  const prompt = "Generate a concise 3-7 word title for this conversation. Output ONLY the title.";

  try {
    const { stdout } = await execAsync(
      `claude --model haiku --print --system-prompt "${systemPrompt}" "${prompt}" < "${contentFilePath}"`,
      { timeout: 30000 }
    );

    const title = stdout.trim();
    // Validate output - should be a reasonable title
    if (title && title.length > 0 && title.length < 100 && !title.includes("\n")) {
      return title;
    }
    return null;
  } catch (error) {
    console.error("AI title generation failed:", error);
    return null;
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(contentFilePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Read kanban state from disk
 * Merges active cards from kanban.json and archived cards from kanban-archive.json
 * Returns empty state if files don't exist
 */
export async function getKanbanState(): Promise<KanbanState> {
  let activeState: KanbanState = createEmptyKanbanState();
  let archivedCards: KanbanCard[] = [];

  // Read active state
  try {
    const content = await fs.readFile(kanbanStatePath(), "utf8");
    const state = JSON.parse(content) as KanbanState;
    if (state.version === 1 && Array.isArray(state.cards)) {
      activeState = state;
    }
  } catch {
    // File doesn't exist or is invalid
  }

  // Read archived cards
  try {
    const content = await fs.readFile(kanbanArchivePath(), "utf8");
    const archiveState = JSON.parse(content) as { cards: KanbanCard[] };
    if (Array.isArray(archiveState.cards)) {
      archivedCards = archiveState.cards;
    }
  } catch {
    // File doesn't exist or is invalid
  }

  // Merge cards (active + archived)
  return {
    ...activeState,
    cards: [...activeState.cards, ...archivedCards],
  };
}

/**
 * Save kanban state to disk
 * Splits cards: archived → kanban-archive.json, others → kanban.json
 */
export async function saveKanbanState(state: KanbanState): Promise<void> {
  await ensureDir();
  const now = new Date().toISOString();

  // Split cards by archive status
  const activeCards = state.cards.filter(c => c.status !== "archive");
  const archivedCards = state.cards.filter(c => c.status === "archive");

  // Save active state (with metadata)
  const activeState: KanbanState = {
    ...state,
    cards: activeCards,
    lastSyncedAt: now,
  };
  await fs.writeFile(kanbanStatePath(), JSON.stringify(activeState, null, 2), "utf8");

  // Save archived cards (minimal structure)
  const archiveState = {
    cards: archivedCards,
    lastSyncedAt: now,
  };
  await fs.writeFile(kanbanArchivePath(), JSON.stringify(archiveState, null, 2), "utf8");
}

/**
 * Generate a title for a card from session data
 * Tries AI generation first, then falls back to git branch / last message
 */
export async function generateTitle(project: string, sessionId: string, useAI = true): Promise<{ title: string; version?: number }> {
  // Try AI-powered title generation first
  if (useAI) {
    try {
      const sessionContent = await extractSessionContent(project, sessionId);
      if (sessionContent) {
        // Write to temp file for claude CLI
        const tempFile = path.join(tmpdir(), `kanban-title-${nanoid(8)}.txt`);
        await fs.writeFile(tempFile, sessionContent, "utf8");

        const aiTitle = await generateAITitle(tempFile);
        if (aiTitle) {
          return { title: aiTitle, version: 1 };
        }
      }
    } catch (error) {
      console.error("AI title generation failed, falling back:", error);
    }
  }

  // Fallback to traditional title generation
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
        return { title: branch.charAt(0).toUpperCase() + branch.slice(1) };
      }
      // Use last message truncated
      if (preview.lastMessage && preview.lastMessage !== "Session in progress") {
        return { title: preview.lastMessage.slice(0, 50) + (preview.lastMessage.length > 50 ? "..." : "") };
      }
    }
  } catch {
    // Ignore errors, fall back to session ID
  }
  // Fallback to session ID
  return { title: `Session ${sessionId.slice(0, 8)}` };
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

  // Create cards for new sessions with fallback titles (no AI generation)
  // AI title generation is available via manual migration script: pnpm migrate:titles
  // Skip haiku sessions - they don't get cards
  const newCards: KanbanCard[] = [];
  for (const session of newSessions) {
    // Skip haiku sessions
    if (await isHaikuSession(session.project, session.sessionId)) {
      continue;
    }

    const { title } = await generateTitle(session.project, session.sessionId, false);
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

  console.log(`[kanban] Sync complete: ${newCards.length} new cards added`);

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
