/**
 * Drizzle schema for kanban SQLite database
 * Location: ~/.claude/cc-viz/kanban.db
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Kanban status enum values
 * Stored as text in SQLite
 */
export const kanbanStatuses = [
  "archive",
  "back-log",
  "in-progress",
  "discard",
  "complete",
] as const;

export type KanbanStatusDb = (typeof kanbanStatuses)[number];

/**
 * Active stories table
 */
export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  project: text("project").notNull(),
  branch: text("branch"), // null for "No Branch" story
  prLink: text("pr_link"),
  status: text("status").notNull().default("back-log"),
  order: integer("order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Sessions belonging to active stories
 */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  timestamp: text("timestamp").notNull(),
  link: text("link").notNull(),
});

/**
 * Archived stories table - same schema as stories
 */
export const storiesArchive = sqliteTable("stories_archive", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  project: text("project").notNull(),
  branch: text("branch"),
  prLink: text("pr_link"),
  status: text("status").notNull(),
  order: integer("order").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at").notNull(), // extra field for archive time
});

/**
 * Archived sessions table - same schema as sessions
 */
export const sessionsArchive = sqliteTable("sessions_archive", {
  id: text("id").primaryKey(),
  storyId: text("story_id")
    .notNull()
    .references(() => storiesArchive.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  timestamp: text("timestamp").notNull(),
  link: text("link").notNull(),
});

/**
 * Metadata table for sync state
 */
export const metadata = sqliteTable("metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Type exports for Drizzle inference
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type StoryArchive = typeof storiesArchive.$inferSelect;
export type SessionArchive = typeof sessionsArchive.$inferSelect;
