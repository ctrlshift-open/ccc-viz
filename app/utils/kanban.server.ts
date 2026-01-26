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
import { getSessionPreview } from "~/sessions.server";
import { getProjects } from "~/projects.server";
import { resolveSessionFile } from "~/utils/path-safety.server";
import {
  getKanbanStateFromDb,
  getStoryByProjectBranch,
  createStory,
  createSession,
  sessionExists,
  updateStory,
  updateStoryStatusAndOrder,
  getNextOrder,
  setLastSyncedAt,
} from "~/db/queries.server";

const execAsync = promisify(exec);

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
 * Read kanban state from SQLite database
 * @returns KanbanState with all active and archived stories
 */
export function getKanbanState(): KanbanState {
  return getKanbanStateFromDb();
}

/**
 * Update last sync timestamp in database
 */
export function saveKanbanSyncTime(): void {
  const now = new Date().toISOString();
  setLastSyncedAt(now);
}

/**
 * Get all session IDs across all projects with git branch info
 * @param limit Max sessions to return (default 20, most recent first)
 */
async function getAllSessions(limit: number = 20): Promise<Array<{ project: string; sessionId: string; timestamp: string; gitBranch: string | null }>> {
  const { projects } = await getProjects();
  const allSessions: Array<{ project: string; sessionId: string; timestamp: string; gitBranch: string | null }> = [];

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
          allSessions.push({
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
  allSessions.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return allSessions.slice(0, limit);
}

/**
 * Sync sessions to kanban stories
 * Groups sessions by project+branch, creates stories as needed
 * Returns count of new stories and sessions added
 */
export async function syncSessionsToStories(): Promise<{ newStories: number; newSessions: number }> {
  const allSessions = await getAllSessions();

  console.log(`[kanban] Found ${allSessions.length} sessions to process`);
  if (allSessions.length > 0) {
    console.log(`[kanban] First session:`, allSessions[0]);
  }

  let newStoryCount = 0;
  let newSessionCount = 0;
  let skippedHaiku = 0;

  // Process each session from disk
  for (const session of allSessions) {
    // Check if session already exists in DB
    if (sessionExists(session.project, session.sessionId)) continue;

    // Skip haiku sessions
    if (await isHaikuSession(session.project, session.sessionId)) {
      skippedHaiku++;
      continue;
    }

    // Find or create story for this project+branch
    let story = getStoryByProjectBranch(session.project, session.gitBranch);

    if (!story) {
      // Create new story
      const prLink = session.gitBranch
        ? await detectPRLink(session.project, session.gitBranch)
        : null;

      const now = new Date().toISOString();
      const newStory = createStory({
        id: nanoid(10),
        title: session.gitBranch ?? "No Branch",
        project: session.project,
        branch: session.gitBranch,
        prLink,
        status: "in-progress",
        order: getNextOrder("in-progress"),
        createdAt: now,
        updatedAt: now,
      });

      // Refetch to get the full story with sessions array
      story = getStoryByProjectBranch(session.project, session.gitBranch);
      newStoryCount++;
    }

    if (!story) continue; // Safety check

    // Generate AI name for session
    const sessionName = await generateSessionName(session.project, session.sessionId);

    // Build session link
    const link = `/${encodeURIComponent(session.project)}/sessions/${encodeURIComponent(session.sessionId)}`;

    // Create session in DB
    createSession({
      id: session.sessionId,
      storyId: story.id,
      name: sessionName,
      timestamp: session.timestamp,
      link,
    });

    // Update story's updatedAt
    updateStory(story.id, { updatedAt: new Date().toISOString() });
    newSessionCount++;
  }

  // Update last sync time
  saveKanbanSyncTime();

  console.log(`[kanban] Sync complete: ${newStoryCount} new stories, ${newSessionCount} new sessions, ${skippedHaiku} skipped (haiku)`);

  return { newStories: newStoryCount, newSessions: newSessionCount };
}

/**
 * Update a story's status and reorder within column
 * Uses DB operations directly
 */
export function updateStoryStatusDb(
  storyId: string,
  newStatus: KanbanStatus,
  newOrder?: number
): void {
  updateStoryStatusAndOrder(storyId, newStatus, newOrder);
}

/**
 * Update a story's PR link
 * Uses DB operations directly
 */
export function updateStoryPRLinkDb(
  storyId: string,
  prLink: string | null
): void {
  updateStory(storyId, { prLink, updatedAt: new Date().toISOString() });
}

/**
 * Update a story's title
 * Uses DB operations directly
 */
export function updateStoryTitleDb(
  storyId: string,
  title: string
): void {
  updateStory(storyId, { title, updatedAt: new Date().toISOString() });
}

/**
 * Sync a single session to the kanban board
 * Called when the file watcher detects a new session
 * @returns true if session was added, false if skipped/exists
 */
export async function syncOneSession(
  project: string,
  sessionId: string
): Promise<{ added: boolean; reason?: string }> {
  console.log(`[kanban] Syncing single session: ${project}/${sessionId}`);

  // Check if session already exists in DB
  if (sessionExists(project, sessionId)) {
    console.log(`[kanban] Session ${sessionId} already exists, skipping`);
    return { added: false, reason: "exists" };
  }

  // Skip haiku sessions
  if (await isHaikuSession(project, sessionId)) {
    console.log(`[kanban] Session ${sessionId} is haiku, skipping`);
    return { added: false, reason: "haiku" };
  }

  // Get session details from preview
  const preview = await getSessionPreview(project, sessionId);
  const gitBranch = preview?.gitBranch ?? null;

  // Get file timestamp
  const { file } = resolveSessionFile(project, sessionId);
  let timestamp: string;
  try {
    const stats = await fs.stat(file);
    timestamp = stats.mtime.toISOString();
  } catch {
    timestamp = new Date().toISOString();
  }

  // Find or create story for this project+branch
  let story = getStoryByProjectBranch(project, gitBranch);
  let createdNewStory = false;

  if (!story) {
    // Create new story
    const prLink = gitBranch
      ? await detectPRLink(project, gitBranch)
      : null;

    const now = new Date().toISOString();
    createStory({
      id: nanoid(10),
      title: gitBranch ?? "No Branch",
      project,
      branch: gitBranch,
      prLink,
      status: "in-progress",
      order: getNextOrder("in-progress"),
      createdAt: now,
      updatedAt: now,
    });

    // Refetch to get the full story
    story = getStoryByProjectBranch(project, gitBranch);
    createdNewStory = true;
  }

  if (!story) {
    console.error(`[kanban] Failed to create/find story for ${project}/${gitBranch}`);
    return { added: false, reason: "story_error" };
  }

  // Generate AI name for session
  const sessionName = await generateSessionName(project, sessionId);

  // Build session link
  const link = `/${encodeURIComponent(project)}/sessions/${encodeURIComponent(sessionId)}`;

  // Create session in DB
  createSession({
    id: sessionId,
    storyId: story.id,
    name: sessionName,
    timestamp,
    link,
  });

  // Update story's updatedAt
  updateStory(story.id, { updatedAt: new Date().toISOString() });

  console.log(`[kanban] Added session ${sessionId} to story ${story.id}${createdNewStory ? " (new story)" : ""}`);

  return { added: true };
}
