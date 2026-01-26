CREATE TABLE `metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`timestamp` text NOT NULL,
	`link` text NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions_archive` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`timestamp` text NOT NULL,
	`link` text NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories_archive`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`project` text NOT NULL,
	`branch` text,
	`pr_link` text,
	`status` text DEFAULT 'back-log' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stories_archive` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`project` text NOT NULL,
	`branch` text,
	`pr_link` text,
	`status` text NOT NULL,
	`order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text NOT NULL
);
