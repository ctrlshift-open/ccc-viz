#!/usr/bin/env npx tsx
/**
 * Migration script to update kanban card titles with AI-generated versions.
 * Processes cards that don't have a version field (pre-AI cards).
 * Resume-safe: saves state after each card.
 *
 * Usage: pnpm migrate:titles
 */

import { homedir, tmpdir } from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { nanoid } from "nanoid";

const execAsync = promisify(exec);

interface KanbanCard {
  id: string;
  title: string;
  sessionIds: string[];
  project: string;
  status: string;
  order: number;
  gitBranch?: string;
  createdAt: string;
  updatedAt: string;
  version?: number;
}

interface KanbanState {
  version: number;
  cards: KanbanCard[];
  importedSessionIds: string[];
  lastSyncedAt: string;
}

const KANBAN_PATH = path.join(homedir(), ".claude", "cc-viz", "kanban.json");
const PROJECTS_PATH = path.join(homedir(), ".claude", "projects");

async function loadKanbanState(): Promise<KanbanState | null> {
  try {
    const content = await fs.readFile(KANBAN_PATH, "utf8");
    return JSON.parse(content) as KanbanState;
  } catch {
    console.error("Failed to load kanban.json");
    return null;
  }
}

async function saveKanbanState(state: KanbanState): Promise<void> {
  state.lastSyncedAt = new Date().toISOString();
  await fs.writeFile(KANBAN_PATH, JSON.stringify(state, null, 2), "utf8");
}

async function extractSessionContent(project: string, sessionId: string): Promise<string | null> {
  const safePath = project.replace(/\.\./g, "").replace(/[<>:"|?*]/g, "");
  const sessionFile = path.join(PROJECTS_PATH, safePath, `${sessionId}.jsonl`);

  try {
    const content = await fs.readFile(sessionFile, "utf8");
    const lines = content.split(/\r?\n/).filter((l) => l.length > 0);

    const userMessages: string[] = [];
    const assistantMessages: string[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);

        if (parsed.type === "user" && parsed.message) {
          const msgContent = parsed.message.content;
          let text = "";
          if (Array.isArray(msgContent)) {
            const textItem = msgContent.find(
              (c: string | { type: string; text?: string }) =>
                typeof c === "string" || c.type === "text"
            );
            text = typeof textItem === "string" ? textItem : textItem?.text || "";
          } else if (typeof msgContent === "string") {
            text = msgContent;
          }
          if (text && !text.startsWith("/")) {
            userMessages.push(text.slice(0, 500));
          }
        }

        if (parsed.type === "assistant" && parsed.message) {
          const msgContent = parsed.message.content;
          if (Array.isArray(msgContent)) {
            const textItem = msgContent.find((c: { type: string; text?: string }) => c.type === "text");
            if (textItem?.text) {
              assistantMessages.push(textItem.text.slice(0, 500));
            }
          } else if (typeof msgContent === "string") {
            assistantMessages.push(msgContent.slice(0, 500));
          }
        }
      } catch {
        // Skip invalid JSON
      }
    }

    if (userMessages.length === 0 && assistantMessages.length === 0) {
      return null;
    }

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

async function generateAITitle(contentFilePath: string): Promise<string | null> {
  const prompt = `Read the conversation excerpts and generate a concise title (3-7 words) that captures the main topic or goal. Output ONLY the title, no quotes, no explanation.`;

  try {
    const { stdout } = await execAsync(
      `claude --model haiku --print "${prompt}" < "${contentFilePath}"`,
      { timeout: 30000 }
    );

    const title = stdout.trim();
    if (title && title.length > 0 && title.length < 100 && !title.includes("\n")) {
      return title;
    }
    return null;
  } catch (error) {
    console.error("  AI generation failed:", error instanceof Error ? error.message : error);
    return null;
  } finally {
    try {
      await fs.unlink(contentFilePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function main(): Promise<void> {
  console.log("Kanban Title Migration\n");

  const state = await loadKanbanState();
  if (!state) {
    console.error("Could not load kanban state. Exiting.");
    process.exit(1);
  }

  // Find cards without version (pre-AI cards)
  const cardsToMigrate = state.cards.filter((c) => c.version === undefined);
  const total = cardsToMigrate.length;

  if (total === 0) {
    console.log("All cards already have AI-generated titles. Nothing to migrate.");
    process.exit(0);
  }

  console.log(`Found ${total} cards without AI titles.\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < cardsToMigrate.length; i++) {
    const card = cardsToMigrate[i];
    const progress = `[${i + 1}/${total}]`;
    const oldTitle = card.title;

    console.log(`${progress} Processing: "${oldTitle}"`);

    // Use first session for title generation
    const sessionId = card.sessionIds[0];
    if (!sessionId) {
      console.log(`  Skipped: No sessionIds`);
      failCount++;
      continue;
    }

    const sessionContent = await extractSessionContent(card.project, sessionId);
    if (!sessionContent) {
      console.log(`  Skipped: Could not extract session content`);
      failCount++;
      continue;
    }

    // Write to temp file
    const tempFile = path.join(tmpdir(), `migrate-title-${nanoid(8)}.txt`);
    await fs.writeFile(tempFile, sessionContent, "utf8");

    const newTitle = await generateAITitle(tempFile);
    if (!newTitle) {
      console.log(`  Skipped: AI generation failed`);
      failCount++;
      continue;
    }

    // Update card in state
    const cardInState = state.cards.find((c) => c.id === card.id);
    if (cardInState) {
      cardInState.title = newTitle;
      cardInState.version = 1;
      cardInState.updatedAt = new Date().toISOString();
    }

    // Save state after each card (resume-safe)
    await saveKanbanState(state);

    console.log(`  → "${newTitle}"`);
    successCount++;
  }

  console.log(`\nMigration complete:`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Skipped: ${failCount}`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
