/**
 * SQLite database singleton with WAL mode
 * Location: ~/.claude/cc-viz/kanban.db
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync, existsSync } from "node:fs";

// Database path
const DB_DIR = join(homedir(), ".claude", "cc-viz");
const DB_PATH = join(DB_DIR, "kanban.db");

// Singleton instance
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteDb: Database.Database | null = null;

/**
 * Get or create the database connection
 * Uses WAL mode for better concurrent access
 */
export function getDb() {
  if (db) return db;

  // Ensure directory exists
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  // Create SQLite connection
  sqliteDb = new Database(DB_PATH);

  // Enable WAL mode for better concurrent access
  sqliteDb.pragma("journal_mode = WAL");

  // Create Drizzle instance
  db = drizzle(sqliteDb, { schema });

  // Initialize tables
  initTables();

  return db;
}

/**
 * Initialize database tables if they don't exist
 */
function initTables() {
  if (!sqliteDb) return;

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      project TEXT NOT NULL,
      branch TEXT,
      pr_link TEXT,
      status TEXT NOT NULL DEFAULT 'back-log',
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      link TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories_archive (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      project TEXT NOT NULL,
      branch TEXT,
      pr_link TEXT,
      status TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions_archive (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL REFERENCES stories_archive(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      link TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_story_id ON sessions(story_id);
    CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_archive_story_id ON sessions_archive(story_id);
  `);
}

/**
 * Close the database connection
 * Useful for tests and graceful shutdown
 */
export function closeDb() {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    db = null;
  }
}

/**
 * Get the underlying better-sqlite3 database instance
 * Needed for transaction support
 */
export function getSqliteDb() {
  if (!sqliteDb) {
    getDb(); // Initialize if not already done
  }
  return sqliteDb!;
}

/**
 * Get the database path
 */
export function getDbPath() {
  return DB_PATH;
}

// Re-export schema for convenience
export * from "./schema";
