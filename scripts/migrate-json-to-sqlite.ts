#!/usr/bin/env npx tsx
/**
 * One-time migration script: JSON files -> SQLite database
 *
 * Reads:
 *   ~/.claude/cc-viz/kanban.json
 *   ~/.claude/cc-viz/kanban-archive.json
 *
 * Writes:
 *   ~/.claude/cc-viz/kanban.db
 *
 * Usage:
 *   npx tsx scripts/migrate-json-to-sqlite.ts
 *   npx tsx scripts/migrate-json-to-sqlite.ts --dry-run
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, existsSync, renameSync } from "node:fs";
import { getDb, closeDb, getDbPath } from "../app/db/index.server";
import { saveKanbanStateToDb, getKanbanStateFromDb } from "../app/db/queries.server";
import type { KanbanState, KanbanStory, KanbanStatus } from "../app/types/kanban";

const CC_VIZ_DIR = join(homedir(), ".claude", "cc-viz");
const KANBAN_JSON = join(CC_VIZ_DIR, "kanban.json");
const KANBAN_ARCHIVE_JSON = join(CC_VIZ_DIR, "kanban-archive.json");

function log(msg: string) {
  console.log(`[migrate] ${msg}`);
}

function logError(msg: string) {
  console.error(`[migrate] ERROR: ${msg}`);
}

/**
 * Read JSON file safely
 */
function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = readFileSync(path, "utf8");
    return JSON.parse(content) as T;
  } catch (err) {
    logError(`Failed to read ${path}: ${err}`);
    return null;
  }
}

/**
 * Load kanban state from JSON files
 */
function loadJsonState(): KanbanState | null {
  // Read active state
  const activeState = readJsonFile<KanbanState>(KANBAN_JSON);
  if (!activeState) {
    log("No kanban.json found");
    return null;
  }

  // Validate version
  if (activeState.version !== 2) {
    logError(`Invalid version: ${activeState.version} (expected 2)`);
    return null;
  }

  // Read archived state
  const archiveState = readJsonFile<{ version: number; stories: KanbanStory[] }>(KANBAN_ARCHIVE_JSON);

  // Merge stories
  let allStories = [...activeState.stories];
  if (archiveState && archiveState.version === 2 && Array.isArray(archiveState.stories)) {
    // Mark archived stories with "archive" status if not already set
    const archivedStories = archiveState.stories.map((s) => ({
      ...s,
      status: "archive" as KanbanStatus,
    }));
    allStories = [...allStories, ...archivedStories];
  }

  return {
    version: 2,
    stories: allStories,
    lastSyncedAt: activeState.lastSyncedAt,
  };
}

/**
 * Print migration summary
 */
function printSummary(state: KanbanState) {
  const activeStories = state.stories.filter((s) => s.status !== "archive");
  const archivedStories = state.stories.filter((s) => s.status === "archive");
  const totalSessions = state.stories.reduce((acc, s) => acc + s.sessions.length, 0);

  log("Migration summary:");
  log(`  Active stories: ${activeStories.length}`);
  log(`  Archived stories: ${archivedStories.length}`);
  log(`  Total sessions: ${totalSessions}`);
  log(`  Last synced: ${state.lastSyncedAt}`);
}

/**
 * Verify migration by comparing counts
 */
function verifyMigration(original: KanbanState): boolean {
  const dbState = getKanbanStateFromDb();

  const originalCount = original.stories.length;
  const dbCount = dbState.stories.length;
  const originalSessions = original.stories.reduce((acc, s) => acc + s.sessions.length, 0);
  const dbSessions = dbState.stories.reduce((acc, s) => acc + s.sessions.length, 0);

  log("Verification:");
  log(`  Stories: ${originalCount} -> ${dbCount} ${originalCount === dbCount ? "OK" : "MISMATCH"}`);
  log(`  Sessions: ${originalSessions} -> ${dbSessions} ${originalSessions === dbSessions ? "OK" : "MISMATCH"}`);

  return originalCount === dbCount && originalSessions === dbSessions;
}

/**
 * Backup JSON files by renaming
 */
function backupJsonFiles() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (existsSync(KANBAN_JSON)) {
    const backup = join(CC_VIZ_DIR, `kanban.${timestamp}.json.bak`);
    renameSync(KANBAN_JSON, backup);
    log(`Backed up: ${KANBAN_JSON} -> ${backup}`);
  }

  if (existsSync(KANBAN_ARCHIVE_JSON)) {
    const backup = join(CC_VIZ_DIR, `kanban-archive.${timestamp}.json.bak`);
    renameSync(KANBAN_ARCHIVE_JSON, backup);
    log(`Backed up: ${KANBAN_ARCHIVE_JSON} -> ${backup}`);
  }
}

/**
 * Main migration function
 */
function migrate(dryRun: boolean) {
  log(`Starting migration ${dryRun ? "(DRY RUN)" : ""}`);
  log(`Source: ${KANBAN_JSON}`);
  log(`Target: ${getDbPath()}`);

  // Load JSON state
  const state = loadJsonState();
  if (!state) {
    log("No data to migrate");
    return;
  }

  printSummary(state);

  if (dryRun) {
    log("DRY RUN - no changes made");
    return;
  }

  // Initialize DB (creates tables)
  getDb();

  // Save to SQLite
  log("Writing to SQLite...");
  saveKanbanStateToDb(state);

  // Verify
  const verified = verifyMigration(state);
  if (!verified) {
    logError("Migration verification failed!");
    closeDb();
    process.exit(1);
  }

  // Backup JSON files
  log("Backing up JSON files...");
  backupJsonFiles();

  closeDb();
  log("Migration complete!");
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
migrate(dryRun);
