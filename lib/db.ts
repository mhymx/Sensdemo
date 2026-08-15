import { env } from "cloudflare:workers";

type PreparedStatement = {
  bind: (...values: unknown[]) => PreparedStatement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

export type HostedDatabase = {
  prepare: (query: string) => PreparedStatement;
  batch: (statements: PreparedStatement[]) => Promise<unknown[]>;
};

let schemaPromise: Promise<void> | null = null;

export function getDatabase() {
  const runtimeEnv = env as unknown as { DB?: HostedDatabase };
  if (!runtimeEnv.DB) {
    throw new Error("The hosted DB binding is unavailable.");
  }
  return runtimeEnv.DB;
}

export async function ensureSchema() {
  if (!schemaPromise) {
    const database = getDatabase();
    schemaPromise = database
      .batch([
        database.prepare(
          "CREATE TABLE IF NOT EXISTS devices (device TEXT PRIMARY KEY, room TEXT NOT NULL, status TEXT NOT NULL, event TEXT NOT NULL, smoke INTEGER, temperature REAL, humidity REAL, wifi_rssi INTEGER, last_seen_at TEXT NOT NULL, last_event_at TEXT NOT NULL, last_detection_at TEXT, status_started_at TEXT NOT NULL)"
        ),
        database.prepare(
          "CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, received_at TEXT NOT NULL, device TEXT NOT NULL, room TEXT NOT NULL, event TEXT NOT NULL, status TEXT NOT NULL, smoke INTEGER, temperature REAL, humidity REAL, wifi_rssi INTEGER, duration_ms INTEGER, notification_status TEXT NOT NULL, notification_error TEXT)"
        ),
        database.prepare(
          "CREATE TABLE IF NOT EXISTS cooldowns (cooldown_key TEXT PRIMARY KEY, last_at INTEGER NOT NULL)"
        ),
        database.prepare(
          "CREATE INDEX IF NOT EXISTS events_received_at_idx ON events(received_at DESC)"
        ),
        database.prepare(
          "CREATE INDEX IF NOT EXISTS events_device_received_at_idx ON events(device, received_at DESC)"
        ),
      ])
      .then(() => undefined)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }

  await schemaPromise;
}

