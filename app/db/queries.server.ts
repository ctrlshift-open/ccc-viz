/**
 * Drizzle query helpers for kanban database operations
 * Replaces JSON file read/write with SQLite queries
 */

import { eq, and, desc, asc, inArray, ne, sql } from "drizzle-orm";
import { getDb, getSqliteDb } from "./index.server";
import {
  stories,
  sessions,
  storiesArchive,
  sessionsArchive,
  metadata,
  type Story,
  type NewStory,
  type Session,
  type NewSession,
} from "./schema";
import type { KanbanStory, KanbanState, KanbanStatus, StorySession } from "~/types/kanban";

// ============================================
// Story Queries
// ============================================

/**
 * Get all active stories with their sessions
 * Ordered by status then order within column
 */
export function getAllStories(): KanbanStory[] {
  const db = getDb();

  const storyRows = db
    .select()
    .from(stories)
    .orderBy(asc(stories.status), asc(stories.order))
    .all();

  return storyRows.map((row) => {
    const sessionRows = db
      .select()
      .from(sessions)
      .where(eq(sessions.storyId, row.id))
      .orderBy(desc(sessions.timestamp))
      .all();

    return dbStoryToKanban(row, sessionRows);
  });
}

/**
 * Get a single story by ID with sessions
 */
export function getStoryById(storyId: string): KanbanStory | null {
  const db = getDb();

  const row = db.select().from(stories).where(eq(stories.id, storyId)).get();
  if (!row) return null;

  const sessionRows = db
    .select()
    .from(sessions)
    .where(eq(sessions.storyId, storyId))
    .orderBy(desc(sessions.timestamp))
    .all();

  return dbStoryToKanban(row, sessionRows);
}

/**
 * Get story by project and branch
 */
export function getStoryByProjectBranch(
  project: string,
  branch: string | null
): KanbanStory | null {
  const db = getDb();

  const row = branch === null
    ? db.select().from(stories).where(and(eq(stories.project, project), sql`${stories.branch} IS NULL`)).get()
    : db.select().from(stories).where(and(eq(stories.project, project), eq(stories.branch, branch))).get();

  if (!row) return null;

  const sessionRows = db
    .select()
    .from(sessions)
    .where(eq(sessions.storyId, row.id))
    .orderBy(desc(sessions.timestamp))
    .all();

  return dbStoryToKanban(row, sessionRows);
}

/**
 * Get stories by status
 */
export function getStoriesByStatus(status: KanbanStatus): KanbanStory[] {
  const db = getDb();

  const storyRows = db
    .select()
    .from(stories)
    .where(eq(stories.status, status))
    .orderBy(asc(stories.order))
    .all();

  return storyRows.map((row) => {
    const sessionRows = db
      .select()
      .from(sessions)
      .where(eq(sessions.storyId, row.id))
      .orderBy(desc(sessions.timestamp))
      .all();

    return dbStoryToKanban(row, sessionRows);
  });
}

/**
 * Create a new story
 */
export function createStory(story: NewStory): Story {
  const db = getDb();
  return db.insert(stories).values(story).returning().get();
}

/**
 * Update story fields
 */
export function updateStory(
  storyId: string,
  updates: Partial<Pick<Story, "title" | "status" | "order" | "prLink" | "updatedAt">>
): Story | null {
  const db = getDb();

  const result = db
    .update(stories)
    .set(updates)
    .where(eq(stories.id, storyId))
    .returning()
    .get();

  return result ?? null;
}

/**
 * Update story status with reordering
 * Handles moving between columns and reordering within a column
 */
export function updateStoryStatusAndOrder(
  storyId: string,
  newStatus: KanbanStatus,
  newOrder?: number
): void {
  const db = getDb();
  const now = new Date().toISOString();

  const story = db.select().from(stories).where(eq(stories.id, storyId)).get();
  if (!story) return;

  const oldStatus = story.status;
  const oldOrder = story.order;

  // Same column reorder
  if (oldStatus === newStatus) {
    if (newOrder === undefined || newOrder === oldOrder) return;

    // Shift stories in column
    if (newOrder > oldOrder) {
      // Moving down: decrement orders between old and new
      db.update(stories)
        .set({ order: sql`${stories.order} - 1` })
        .where(
          and(
            eq(stories.status, oldStatus),
            sql`${stories.order} > ${oldOrder}`,
            sql`${stories.order} <= ${newOrder}`
          )
        )
        .run();
    } else {
      // Moving up: increment orders between new and old
      db.update(stories)
        .set({ order: sql`${stories.order} + 1` })
        .where(
          and(
            eq(stories.status, oldStatus),
            sql`${stories.order} >= ${newOrder}`,
            sql`${stories.order} < ${oldOrder}`
          )
        )
        .run();
    }

    db.update(stories)
      .set({ order: newOrder, updatedAt: now })
      .where(eq(stories.id, storyId))
      .run();

    return;
  }

  // Moving to different column
  // 1. Decrement orders in old column for stories after this one
  db.update(stories)
    .set({ order: sql`${stories.order} - 1` })
    .where(
      and(
        eq(stories.status, oldStatus),
        sql`${stories.order} > ${oldOrder}`
      )
    )
    .run();

  // 2. Get target order (end of new column if not specified)
  let targetOrder = newOrder;
  if (targetOrder === undefined) {
    const maxOrderResult = db
      .select({ maxOrder: sql<number>`MAX(${stories.order})` })
      .from(stories)
      .where(eq(stories.status, newStatus))
      .get();
    targetOrder = (maxOrderResult?.maxOrder ?? -1) + 1;
  } else {
    // Make room at target position
    db.update(stories)
      .set({ order: sql`${stories.order} + 1` })
      .where(
        and(
          eq(stories.status, newStatus),
          sql`${stories.order} >= ${targetOrder}`
        )
      )
      .run();
  }

  // 3. Update the story
  db.update(stories)
    .set({ status: newStatus, order: targetOrder, updatedAt: now })
    .where(eq(stories.id, storyId))
    .run();
}

/**
 * Delete a story and its sessions (cascade delete)
 */
export function deleteStory(storyId: string): boolean {
  const db = getDb();
  const result = db.delete(stories).where(eq(stories.id, storyId)).run();
  return result.changes > 0;
}

/**
 * Get next order number for a status column
 */
export function getNextOrder(status: KanbanStatus): number {
  const db = getDb();
  const result = db
    .select({ maxOrder: sql<number>`MAX(${stories.order})` })
    .from(stories)
    .where(eq(stories.status, status))
    .get();
  return (result?.maxOrder ?? -1) + 1;
}

// ============================================
// Session Queries
// ============================================

/**
 * Get all sessions for a story
 */
export function getSessionsByStoryId(storyId: string): StorySession[] {
  const db = getDb();
  return db
    .select()
    .from(sessions)
    .where(eq(sessions.storyId, storyId))
    .orderBy(desc(sessions.timestamp))
    .all();
}

/**
 * Check if a session exists (by project + sessionId)
 */
export function sessionExists(project: string, sessionId: string): boolean {
  const db = getDb();

  // Find all stories for this project, then check for session
  const storyRows = db
    .select({ id: stories.id })
    .from(stories)
    .where(eq(stories.project, project))
    .all();

  if (storyRows.length === 0) return false;

  const storyIds = storyRows.map((r) => r.id);
  const session = db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), inArray(sessions.storyId, storyIds)))
    .get();

  return !!session;
}

/**
 * Create a new session
 */
export function createSession(session: NewSession): Session {
  const db = getDb();
  return db.insert(sessions).values(session).returning().get();
}

/**
 * Delete a session
 */
export function deleteSession(sessionId: string): boolean {
  const db = getDb();
  const result = db.delete(sessions).where(eq(sessions.id, sessionId)).run();
  return result.changes > 0;
}

// ============================================
// Archive Operations
// ============================================

/**
 * Archive a story - moves to archive tables atomically in a transaction
 * Uses better-sqlite3 transaction for atomicity
 */
export function archiveStory(storyId: string): boolean {
  const db = getDb();
  const sqliteDb = getSqliteDb();
  const now = new Date().toISOString();

  // Get the story first (outside transaction to check existence)
  const story = db.select().from(stories).where(eq(stories.id, storyId)).get();
  if (!story) return false;

  // Get the sessions
  const sessionRows = db
    .select()
    .from(sessions)
    .where(eq(sessions.storyId, storyId))
    .all();

  // Use better-sqlite3 transaction for atomicity
  const archiveTransaction = sqliteDb.transaction(() => {
    // 1. Insert story into archive table
    db.insert(storiesArchive)
      .values({
        ...story,
        archivedAt: now,
      })
      .run();

    // 2. Insert sessions into archive table
    for (const session of sessionRows) {
      db.insert(sessionsArchive).values(session).run();
    }

    // 3. Delete from active tables (sessions cascade deleted via FK)
    db.delete(stories).where(eq(stories.id, storyId)).run();

    // 4. Reorder remaining stories in the column
    db.update(stories)
      .set({ order: sql`${stories.order} - 1` })
      .where(
        and(
          eq(stories.status, story.status),
          sql`${stories.order} > ${story.order}`
        )
      )
      .run();
  });

  // Execute the transaction
  archiveTransaction();

  return true;
}

/**
 * Get all archived stories
 */
export function getArchivedStories(): KanbanStory[] {
  const db = getDb();

  const storyRows = db
    .select()
    .from(storiesArchive)
    .orderBy(desc(storiesArchive.archivedAt))
    .all();

  return storyRows.map((row) => {
    const sessionRows = db
      .select()
      .from(sessionsArchive)
      .where(eq(sessionsArchive.storyId, row.id))
      .orderBy(desc(sessionsArchive.timestamp))
      .all();

    return {
      id: row.id,
      title: row.title,
      project: row.project,
      branch: row.branch,
      prLink: row.prLink,
      status: row.status as KanbanStatus,
      order: row.order,
      sessions: sessionRows.map((s) => ({
        id: s.id,
        name: s.name,
        timestamp: s.timestamp,
        link: s.link,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

// ============================================
// Metadata Operations
// ============================================

/**
 * Get metadata value by key
 */
export function getMetadata(key: string): string | null {
  const db = getDb();
  const row = db.select().from(metadata).where(eq(metadata.key, key)).get();
  return row?.value ?? null;
}

/**
 * Set metadata value
 */
export function setMetadata(key: string, value: string): void {
  const db = getDb();
  db.insert(metadata)
    .values({ key, value })
    .onConflictDoUpdate({ target: metadata.key, set: { value } })
    .run();
}

/**
 * Get last sync timestamp
 */
export function getLastSyncedAt(): string | null {
  return getMetadata("lastSyncedAt");
}

/**
 * Get oldest session timestamp in DB (for sync optimization)
 */
export function getOldestSessionTimestamp(): string | null {
  const db = getDb();
  const result = db
    .select({ timestamp: sessions.timestamp })
    .from(sessions)
    .orderBy(sessions.timestamp)
    .limit(1)
    .get();
  return result?.timestamp ?? null;
}

/**
 * Set last sync timestamp
 */
export function setLastSyncedAt(timestamp: string): void {
  setMetadata("lastSyncedAt", timestamp);
}

// ============================================
// Full State Operations (for compatibility)
// ============================================

/**
 * Get full kanban state (for compatibility with existing code)
 * Combines active and archived stories
 */
export function getKanbanStateFromDb(): KanbanState {
  const activeStories = getAllStories();
  const archivedStories = getArchivedStories();
  const lastSyncedAt = getLastSyncedAt() ?? new Date().toISOString();

  // Set archived stories status to "archive" for display
  const archivedWithStatus = archivedStories.map((s) => ({
    ...s,
    status: "archive" as KanbanStatus,
  }));

  return {
    version: 2,
    stories: [...activeStories, ...archivedWithStatus],
    lastSyncedAt,
  };
}

/**
 * Save full kanban state to database (for migration)
 * This replaces JSON read/write with DB operations
 */
export function saveKanbanStateToDb(state: KanbanState): void {
  const db = getDb();

  // Clear existing data
  db.delete(sessions).run();
  db.delete(stories).run();
  db.delete(sessionsArchive).run();
  db.delete(storiesArchive).run();

  const now = new Date().toISOString();

  for (const story of state.stories) {
    if (story.status === "archive") {
      // Insert into archive tables
      db.insert(storiesArchive)
        .values({
          id: story.id,
          title: story.title,
          project: story.project,
          branch: story.branch,
          prLink: story.prLink,
          status: story.status,
          order: story.order,
          createdAt: story.createdAt,
          updatedAt: story.updatedAt,
          archivedAt: now,
        })
        .run();

      for (const session of story.sessions) {
        db.insert(sessionsArchive)
          .values({
            id: session.id,
            storyId: story.id,
            name: session.name,
            timestamp: session.timestamp,
            link: session.link,
          })
          .run();
      }
    } else {
      // Insert into active tables
      db.insert(stories)
        .values({
          id: story.id,
          title: story.title,
          project: story.project,
          branch: story.branch,
          prLink: story.prLink,
          status: story.status,
          order: story.order,
          createdAt: story.createdAt,
          updatedAt: story.updatedAt,
        })
        .run();

      for (const session of story.sessions) {
        db.insert(sessions)
          .values({
            id: session.id,
            storyId: story.id,
            name: session.name,
            timestamp: session.timestamp,
            link: session.link,
          })
          .run();
      }
    }
  }

  setLastSyncedAt(state.lastSyncedAt);
}

// ============================================
// Helpers
// ============================================

/**
 * Convert DB row to KanbanStory
 */
function dbStoryToKanban(row: Story, sessionRows: Session[]): KanbanStory {
  return {
    id: row.id,
    title: row.title,
    project: row.project,
    branch: row.branch,
    prLink: row.prLink,
    status: row.status as KanbanStatus,
    order: row.order,
    sessions: sessionRows.map((s) => ({
      id: s.id,
      name: s.name,
      timestamp: s.timestamp,
      link: s.link,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
