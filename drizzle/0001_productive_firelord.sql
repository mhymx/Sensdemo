CREATE INDEX `events_received_at_idx` ON `events` (`received_at`);--> statement-breakpoint
CREATE INDEX `events_device_received_at_idx` ON `events` (`device`,`received_at`);