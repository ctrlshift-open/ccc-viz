/**
 * Server-side utilities for kanban board state management
 * Story-based model: one story per project+branch, multiple sessions per story
 */

import { homedir, tmpdir } from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { nanoid } from "nanoid";
import type { KanbanState, KanbanStory, KanbanStatus, StorySession } from "~/types/kanban";
import { createEmptyKanbanState } from "~/types/kanban";
import { getSessionPreview } from "~/sessions.server";
import { getProjects } from "~/projects.server";
import { resolveSessionFile } from "~/utils/path-safety.server";

const execAsync = promisify(exec);

/** Path to kanban state file (active stories) */
function kanbanStatePath(): string {
  return path.join(homedir(), ".claude", "cc-viz", "kanban.json");
}

/** Path to kanban archive file (archived stories) */
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
 * Returns content suitable for AI name generation
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
 * Generate AI session name using Claude CLI with haiku model
 */
async function generateAISessionName(contentFilePath: string): Promise<string | null> {
  const systemPrompt = "Output only the requested text. No explanations, questions, or formatting.";
  const prompt = "Generate a 3-5 word description of this session's work. Output ONLY the description.";

  try {
    const { stdout } = await execAsync(
      `claude --model haiku --print --system-prompt "${systemPrompt}" "${prompt}" < "${contentFilePath}"`,
      { timeout: 30000 }
    );

    const name = stdout.trim();
    // Validate output - should be a reasonable name
    if (name && name.length > 0 && name.length < 60 && !name.includes("\n")) {
      return name;
    }
    return null;
  } catch (error) {
    console.error("AI session name generation failed:", error);
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
 * Generate a name for a session using AI
 */
export async function generateSessionName(project: string, sessionId: string): Promise<string> {
  try {
    const sessionContent = await extractSessionContent(project, sessionId);
    if (sessionContent) {
      const tempFile = path.join(tmpdir(), `session-name-${nanoid(8)}.txt`);
      await fs.writeFile(tempFile, sessionContent, "utf8");

      const aiName = await generateAISessionName(tempFile);
      if (aiName) {
        return aiName;
      }
    }
  } catch (error) {
    console.error("Session name generation failed:", error);
  }

  // Fallback to session ID prefix
  return `Session ${sessionId.slice(0, 8)}`;
}

/**
 * Detect PR link for a branch using GitHub CLI
 */
export async function detectPRLink(projectPath: string, branch: string): Promise<string | null> {
  try {
    // Decode project path (stored as URL-encoded)
    const decodedPath = projectPath.replace(/-/g, "/");
    const fullPath = decodedPath.startsWith("/") ? decodedPath : `/${decodedPath}`;

    const { stdout } = await execAsync(
      `gh pr list --head "${branch}" --json url --limit 1`,
      { cwd: fullPath, timeout: 10000 }
    );

    const prs = JSON.parse(stdout);
    return prs[0]?.url ?? null;
  } catch {
    // PR detection failed (not a git repo, no gh CLI, no PRs, etc.)
    return null;
  }
}

/**
 * Read kanban state from disk
 * Returns empty state if version !== 2 (clears old data)
 */
export async function getKanbanState(): Promise<KanbanState> {
  let activeState: KanbanState = createEmptyKanbanState();
  let archivedStories: KanbanStory[] = [];

  // Read active state
  try {
    const content = await fs.readFile(kanbanStatePath(), "utf8");
    const state = JSON.parse(content);
    // Only accept version 2 (story-based model)
    if (state.version === 2 && Array.isArray(state.stories)) {
      activeState = state as KanbanState;
    }
    // Version 1 or invalid: return empty state (clears old data)
  } catch {
    // File doesn't exist or is invalid
  }

  // Read archived stories
  try {
    const content = await fs.readFile(kanbanArchivePath(), "utf8");
    const archiveState = JSON.parse(content);
    // Check for version 2 archive format
    if (archiveState.version === 2 && Array.isArray(archiveState.stories)) {
      archivedStories = archiveState.stories;
    }
  } catch {
    // File doesn't exist or is invalid
  }

  // Merge stories (active + archived)
  return {
    ...activeState,
    stories: [...activeState.stories, ...archivedStories],
  };
}

/**
 * Save kanban state to disk
 * Splits stories: archived → kanban-archive.json, others → kanban.json
 */
export async function saveKanbanState(state: KanbanState): Promise<void> {
  await ensureDir();
  const now = new Date().toISOString();

  // Split stories by archive status
  const activeStories = state.stories.filter(s => s.status !== "archive");
  const archivedStories = state.stories.filter(s => s.status === "archive");

  // Save active state (with metadata)
  const activeState: KanbanState = {
    ...state,
    stories: activeStories,
    lastSyncedAt: now,
  };
  await fs.writeFile(kanbanStatePath(), JSON.stringify(activeState, null, 2), "utf8");

  // Save archived stories (minimal structure)
  const archiveState = {
    version: 2,
    stories: archivedStories,
    lastSyncedAt: now,
  };
  await fs.writeFile(kanbanArchivePath(), JSON.stringify(archiveState, null, 2), "utf8");
}

/**
 * Get all session IDs across all projects with git branch info
 * @param limit Max sessions to return (default 20, most recent first)
 */
async function getAllSessions(limit: number = 20): Promise<Array<{ project: string; sessionId: string; timestamp: string; gitBranch: string | null }>> {
  const { projects } = await getProjects();
  const sessions: Array<{ project: string; sessionId: string; timestamp: string; gitBranch: string | null }> = [];

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
          // Get git branch from session preview
          const preview = await getSessionPreview(proj.name, sessionId);
          sessions.push({
            project: proj.name,
            sessionId,
            timestamp: stats.mtime.toISOString(),
            gitBranch: preview?.gitBranch ?? null,
          });
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Skip projects we can't read
    }
  }

  // Sort by timestamp descending (most recent first) and limit
  sessions.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return sessions.slice(0, limit);
}

/**
 * Get next order number for a status column
 */
function getNextOrder(stories: KanbanStory[], status: KanbanStatus): number {
  const columnStories = stories.filter(s => s.status === status);
  if (columnStories.length === 0) return 0;
  return Math.max(...columnStories.map(s => s.order)) + 1;
}

/**
 * Sync sessions to kanban stories
 * Groups sessions by project+branch, creates stories as needed
 * Returns count of new stories and sessions added
 */
export async function syncSessionsToStories(): Promise<{ newStories: number; newSessions: number }> {
  const state = await getKanbanState();
  const allSessions = await getAllSessions();

  console.log(`[kanban] Found ${allSessions.length} sessions to process`);
  if (allSessions.length > 0) {
    console.log(`[kanban] First session:`, allSessions[0]);
  }

  let newStoryCount = 0;
  let newSessionCount = 0;
  let skippedHaiku = 0;

  // Build lookup: "project:branch" -> story (branch is "NO_BRANCH" for null)
  const storyLookup = new Map<string, KanbanStory>();
  for (const story of state.stories) {
    const key = `${story.project}:${story.branch ?? "NO_BRANCH"}`;
    storyLookup.set(key, story);
  }

  // Build set of existing session IDs
  const existingSessionIds = new Set<string>();
  for (const story of state.stories) {
    for (const session of story.sessions) {
      existingSessionIds.add(`${story.project}:${session.id}`);
    }
  }

  // Process each session from disk
  for (const session of allSessions) {
    const sessionKey = `${session.project}:${session.sessionId}`;
    if (existingSessionIds.has(sessionKey)) continue; // Already tracked

    // Skip haiku sessions
    if (await isHaikuSession(session.project, session.sessionId)) {
      skippedHaiku++;
      continue;
    }

    const storyKey = `${session.project}:${session.gitBranch ?? "NO_BRANCH"}`;
    let story = storyLookup.get(storyKey);

    if (!story) {
      // Create new story
      const prLink = session.gitBranch
        ? await detectPRLink(session.project, session.gitBranch)
        : null;

      story = {
        id: nanoid(10),
        title: session.gitBranch ?? "No Branch",
        project: session.project,
        branch: session.gitBranch,
        prLink,
        status: "in-progress" as KanbanStatus,
        order: getNextOrder(state.stories, "in-progress"),
        sessions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storyLookup.set(storyKey, story);
      state.stories.push(story);
      newStoryCount++;
    }

    // Generate AI name for session
    const sessionName = await generateSessionName(session.project, session.sessionId);

    // Build session link
    const link = `/${encodeURIComponent(session.project)}/sessions/${encodeURIComponent(session.sessionId)}`;

    story.sessions.push({
      id: session.sessionId,
      name: sessionName,
      timestamp: session.timestamp,
      link,
    });
    story.updatedAt = new Date().toISOString();
    newSessionCount++;
  }

  // Sort sessions within each story by timestamp (newest first)
  for (const story of state.stories) {
    story.sessions.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  await saveKanbanState(state);

  console.log(`[kanban] Sync complete: ${newStoryCount} new stories, ${newSessionCount} new sessions, ${skippedHaiku} skipped (haiku)`);

  return { newStories: newStoryCount, newSessions: newSessionCount };
}

/**
 * Update a story's status and reorder within column
 */
export function updateStoryStatus(
  state: KanbanState,
  storyId: string,
  newStatus: KanbanStatus,
  newOrder?: number
): KanbanState {
  const storyIndex = state.stories.findIndex(s => s.id === storyId);
  if (storyIndex === -1) return state;

  const story = state.stories[storyIndex];
  const oldStatus = story.status;

  // If status changed, need to reorder both columns
  if (oldStatus !== newStatus) {
    // Remove from old column - decrement orders of stories that were after this one
    const updatedStories = state.stories.map(s => {
      if (s.status === oldStatus && s.order > story.order) {
        return { ...s, order: s.order - 1 };
      }
      return s;
    });

    // Add to new column at specified position or end
    const newColumnStories = updatedStories.filter(s => s.status === newStatus);
    const targetOrder = newOrder ?? (newColumnStories.length > 0 ? Math.max(...newColumnStories.map(s => s.order)) + 1 : 0);

    // Shift stories in new column to make room
    const finalStories = updatedStories.map(s => {
      if (s.id === storyId) {
        return { ...s, status: newStatus, order: targetOrder, updatedAt: new Date().toISOString() };
      }
      if (s.status === newStatus && s.order >= targetOrder) {
        return { ...s, order: s.order + 1 };
      }
      return s;
    });

    return { ...state, stories: finalStories };
  }

  // Same column, just reorder
  if (newOrder !== undefined && newOrder !== story.order) {
    const columnStories = state.stories.filter(s => s.status === oldStatus && s.id !== storyId);
    columnStories.splice(newOrder, 0, { ...story, order: newOrder, updatedAt: new Date().toISOString() });

    // Renumber all stories in column
    const reorderedStories = columnStories.map((s, i) => ({ ...s, order: i }));
    const otherStories = state.stories.filter(s => s.status !== oldStatus);

    return { ...state, stories: [...otherStories, ...reorderedStories] };
  }

  return state;
}

/**
 * Update a story's PR link
 */
export function updateStoryPRLink(
  state: KanbanState,
  storyId: string,
  prLink: string | null
): KanbanState {
  const storyIndex = state.stories.findIndex(s => s.id === storyId);
  if (storyIndex === -1) return state;

  const updatedStories = [...state.stories];
  updatedStories[storyIndex] = {
    ...updatedStories[storyIndex],
    prLink,
    updatedAt: new Date().toISOString(),
  };

  return { ...state, stories: updatedStories };
}

/**
 * Update a story's title
 */
export function updateStoryTitle(
  state: KanbanState,
  storyId: string,
  title: string
): KanbanState {
  const storyIndex = state.stories.findIndex(s => s.id === storyId);
  if (storyIndex === -1) return state;

  const updatedStories = [...state.stories];
  updatedStories[storyIndex] = {
    ...updatedStories[storyIndex],
    title,
    updatedAt: new Date().toISOString(),
  };

  return { ...state, stories: updatedStories };
}
