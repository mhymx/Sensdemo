import { integer, index, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const devices = sqliteTable("devices", {
  device: text("device").primaryKey(),
  room: text("room").notNull(),
  status: text("status").notNull(),
  event: text("event").notNull(),
  smoke: integer("smoke"),
  temperature: real("temperature"),
  humidity: real("humidity"),
  wifiRssi: integer("wifi_rssi"),
  lastSeenAt: text("last_seen_at").notNull(),
  lastEventAt: text("last_event_at").notNull(),
  lastDetectionAt: text("last_detection_at"),
  statusStartedAt: text("status_started_at").notNull(),
});

export const events = sqliteTable(
  "events",
  {
  id: text("id").primaryKey(),
  receivedAt: text("received_at").notNull(),
  device: text("device").notNull(),
  room: text("room").notNull(),
  event: text("event").notNull(),
  status: text("status").notNull(),
  smoke: integer("smoke"),
  temperature: real("temperature"),
  humidity: real("humidity"),
  wifiRssi: integer("wifi_rssi"),
  durationMs: integer("duration_ms"),
  notificationStatus: text("notification_status").notNull(),
    notificationError: text("notification_error"),
  },
  (table) => [
    index("events_received_at_idx").on(table.receivedAt),
    index("events_device_received_at_idx").on(table.device, table.receivedAt),
  ]
);

export const cooldowns = sqliteTable("cooldowns", {
  cooldownKey: text("cooldown_key").primaryKey(),
  lastAt: integer("last_at").notNull(),
});
