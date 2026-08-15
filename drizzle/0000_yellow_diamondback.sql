CREATE TABLE `cooldowns` (
	`cooldown_key` text PRIMARY KEY NOT NULL,
	`last_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`device` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`status` text NOT NULL,
	`event` text NOT NULL,
	`smoke` integer,
	`temperature` real,
	`humidity` real,
	`wifi_rssi` integer,
	`last_seen_at` text NOT NULL,
	`last_event_at` text NOT NULL,
	`last_detection_at` text,
	`status_started_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`received_at` text NOT NULL,
	`device` text NOT NULL,
	`room` text NOT NULL,
	`event` text NOT NULL,
	`status` text NOT NULL,
	`smoke` integer,
	`temperature` real,
	`humidity` real,
	`wifi_rssi` integer,
	`duration_ms` integer,
	`notification_status` text NOT NULL,
	`notification_error` text
);
