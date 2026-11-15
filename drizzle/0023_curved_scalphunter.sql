CREATE TABLE `routine` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routine_exercise` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`routine_id` text(21) NOT NULL,
	`exercise_id` text(21) NOT NULL,
	`order` integer NOT NULL,
	`rest_time` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `routine_exercise_routine_idx` ON `routine_exercise` (`routine_id`);--> statement-breakpoint
CREATE TABLE `routine_set` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`routine_exercise_id` text(21) NOT NULL,
	`order` integer NOT NULL,
	`type` text DEFAULT 'working' NOT NULL,
	`weight` real,
	`reps` integer,
	`time` integer,
	`distance` real,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `routine_set_routine_exercise_idx` ON `routine_set` (`routine_exercise_id`);