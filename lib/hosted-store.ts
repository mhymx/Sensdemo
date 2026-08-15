import { createIntegrations } from "../backend/src/integrations.mjs";
import { validateAlert } from "../backend/src/validation.mjs";
import { ensureSchema, getDatabase } from "./db";
import type { HostedConfig } from "./config";

type DeviceRow = {
  device: string;
  room: string;
  status: string;
  event: string;
  smoke: number | null;
  temperature: number | null;
  humidity: number | null;
  wifi_rssi: number | null;
  last_seen_at: string;
  last_event_at: string;
  last_detection_at: string | null;
  status_started_at: string;
};

type EventRow = {
  id: string;
  received_at: string;
  device: string;
  room: string;
  event: string;
  status: string;
  smoke: number | null;
  temperature: number | null;
  humidity: number | null;
  wifi_rssi: number | null;
  duration_ms: number | null;
  notification_status: string;
  notification_error: string | null;
};

type CooldownRow = {
  cooldown_key: string;
  last_at: number;
};

export type HostedAlert = {
  device: string;
  event: string;
  status: string;
  smoke: number;
  temperature: number | null;
  humidity: number | null;
  wifi_rssi: number | null;
  room: string | null;
  duration_ms: number | null;
};

type HostedValidation =
  | { ok: true; value: HostedAlert }
  | { ok: false; errors: string[] };

function nowIso() {
  return new Date().toISOString();
}

function online(lastSeenAt: string, offlineAfterMs: number) {
  return Date.now() - Date.parse(lastSeenAt) <= offlineAfterMs;
}

function deviceFromRow(row: DeviceRow, offlineAfterMs: number) {
  return {
    device: row.device,
    room: row.room,
    status: row.status,
    event: row.event,
    smoke: row.smoke,
    temperature: row.temperature,
    humidity: row.humidity,
    wifi_rssi: row.wifi_rssi,
    lastSeenAt: row.last_seen_at,
    lastEventAt: row.last_event_at,
    lastDetectionAt: row.last_detection_at,
    statusStartedAt: row.status_started_at,
    online: online(row.last_seen_at, offlineAfterMs),
  };
}

function eventFromRow(row: EventRow) {
  return {
    id: row.id,
    received_at: row.received_at,
    device: row.device,
    room: row.room,
    event: row.event,
    status: row.status,
    smoke: row.smoke,
    temperature: row.temperature,
    humidity: row.humidity,
    wifi_rssi: row.wifi_rssi,
    duration_ms: row.duration_ms,
    notification_status: row.notification_status,
    ...(row.notification_error ? { notification_error: row.notification_error } : {}),
  };
}

export function validateHostedAlert(payload: unknown): HostedValidation {
  const result = validateAlert(payload) as {
    ok: boolean;
    errors?: string[];
    value?: HostedAlert;
  };
  if (!result.ok) {
    return { ok: false, errors: result.errors || ["invalid alert payload"] };
  }
  return { ok: true, value: result.value as HostedAlert };
}

export async function getHostedHealth(config: HostedConfig) {
  await ensureSchema();
  return {
    ok: true,
    service: "snoopsmoke-hosted",
    time: nowIso(),
    blynk_configured: Boolean(config.blynk.authToken),
    notification_configured: Boolean(config.notificationWebhookUrl),
  };
}

export async function recordHostedAlert(alert: HostedAlert, config: HostedConfig) {
  await ensureSchema();
  const database = getDatabase();
  const receivedAt = nowIso();
  const previous = await database
    .prepare("SELECT * FROM devices WHERE device = ?")
    .bind(alert.device)
    .first<DeviceRow>();

  const room = alert.room || previous?.room || config.roomId;
  const statusChanged = !previous || previous.status !== alert.status;
  const previousStartedAt = previous?.status_started_at
    ? Date.parse(previous.status_started_at)
    : Number.NaN;
  const calculatedDuration = Number.isFinite(previousStartedAt)
    ? Math.max(0, Date.now() - previousStartedAt)
    : null;
  const durationMs = alert.duration_ms ?? (statusChanged ? calculatedDuration : 0);
  const notificationKey = alert.device + ":" + alert.event;
  const blynkEventKey = "blynk:" + notificationKey;
  const cooldowns = await database
    .prepare("SELECT cooldown_key, last_at FROM cooldowns WHERE cooldown_key IN (?, ?)")
    .bind(notificationKey, blynkEventKey)
    .all<CooldownRow>();
  const lastTimes = new Map(cooldowns.results.map((row) => [row.cooldown_key, row.last_at]));
  const nowMs = Date.now();
  const lastNotificationAt = lastTimes.get(notificationKey) || 0;
  const notificationCandidate =
    alert.event === "SMOKE_DETECTED" ||
    (alert.event === "POSSIBLE_SMOKE" && config.notifyPossibleSmoke) ||
    (alert.event === "CLEAR" && config.notifyClear);
  const notificationSuppressed =
    notificationCandidate &&
    lastNotificationAt > 0 &&
    nowMs - lastNotificationAt < config.alertCooldownMs;
  const shouldNotify = notificationCandidate && !notificationSuppressed;
  const lastBlynkEventAt = lastTimes.get(blynkEventKey) || 0;
  const blynkEventSuppressed =
    lastBlynkEventAt > 0 &&
    nowMs - lastBlynkEventAt < config.alertCooldownMs;
  const shouldBlynkEvent = !blynkEventSuppressed;
  const eventId = globalThis.crypto.randomUUID();
  const eventRecord = {
    id: eventId,
    received_at: receivedAt,
    device: alert.device,
    room,
    event: alert.event,
    status: alert.status,
    smoke: alert.smoke,
    temperature: alert.temperature,
    humidity: alert.humidity,
    wifi_rssi: alert.wifi_rssi,
    duration_ms: durationMs,
    notification_status: notificationCandidate
      ? notificationSuppressed
        ? "suppressed"
        : "pending"
      : "not_requested",
  };
  const deviceState = {
    device: alert.device,
    room,
    status: alert.status,
    event: alert.event,
    smoke: alert.smoke,
    temperature: alert.temperature,
    humidity: alert.humidity,
    wifi_rssi: alert.wifi_rssi,
    lastSeenAt: receivedAt,
    lastEventAt: receivedAt,
    lastDetectionAt:
      alert.event === "SMOKE_DETECTED"
        ? receivedAt
        : previous?.last_detection_at || null,
    statusStartedAt: statusChanged
      ? receivedAt
      : previous?.status_started_at || receivedAt,
    online: true,
  };

  const statements = [
    database
      .prepare(
        "INSERT INTO events (id, received_at, device, room, event, status, smoke, temperature, humidity, wifi_rssi, duration_ms, notification_status, notification_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)"
      )
      .bind(
        eventRecord.id,
        eventRecord.received_at,
        eventRecord.device,
        eventRecord.room,
        eventRecord.event,
        eventRecord.status,
        eventRecord.smoke,
        eventRecord.temperature,
        eventRecord.humidity,
        eventRecord.wifi_rssi,
        eventRecord.duration_ms,
        eventRecord.notification_status
      ),
    database
      .prepare(
        "INSERT INTO devices (device, room, status, event, smoke, temperature, humidity, wifi_rssi, last_seen_at, last_event_at, last_detection_at, status_started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(device) DO UPDATE SET room=excluded.room, status=excluded.status, event=excluded.event, smoke=excluded.smoke, temperature=excluded.temperature, humidity=excluded.humidity, wifi_rssi=excluded.wifi_rssi, last_seen_at=excluded.last_seen_at, last_event_at=excluded.last_event_at, last_detection_at=excluded.last_detection_at, status_started_at=excluded.status_started_at"
      )
      .bind(
        deviceState.device,
        deviceState.room,
        deviceState.status,
        deviceState.event,
        deviceState.smoke,
        deviceState.temperature,
        deviceState.humidity,
        deviceState.wifi_rssi,
        deviceState.lastSeenAt,
        deviceState.lastEventAt,
        deviceState.lastDetectionAt,
        deviceState.statusStartedAt
      ),
  ];

  if (shouldNotify) {
    statements.push(
      database
        .prepare(
          "INSERT INTO cooldowns (cooldown_key, last_at) VALUES (?, ?) ON CONFLICT(cooldown_key) DO UPDATE SET last_at=excluded.last_at"
        )
        .bind(notificationKey, nowMs)
    );
  }
  if (shouldBlynkEvent) {
    statements.push(
      database
        .prepare(
          "INSERT INTO cooldowns (cooldown_key, last_at) VALUES (?, ?) ON CONFLICT(cooldown_key) DO UPDATE SET last_at=excluded.last_at"
        )
        .bind(blynkEventKey, nowMs)
    );
  }
  await database.batch(statements);

  const integrationAlert = {
    ...alert,
    room,
    received_at: receivedAt,
  };
  const integrations = createIntegrations(config);
  const integrationResult = await integrations.forward(integrationAlert, {
    sendNotificationAlert: shouldNotify,
    sendBlynkEvent: shouldBlynkEvent,
  });
  const notificationResult = integrationResult.notification as {
    configured: boolean;
    ok: boolean;
    error?: string;
  };
  if (notificationCandidate && !notificationSuppressed) {
    const status = !notificationResult.configured
      ? "not_configured"
      : notificationResult.ok
        ? "sent"
        : "failed";
    await database
      .prepare("UPDATE events SET notification_status = ?, notification_error = ? WHERE id = ?")
      .bind(status, notificationResult.error || null, eventId)
      .run();
    eventRecord.notification_status = status;
  }

  return {
    event: eventRecord,
    device: deviceState,
    notificationSuppressed,
    integrations: integrationResult,
  };
}

export async function getHostedDevices(config: HostedConfig) {
  await ensureSchema();
  const rows = await getDatabase()
    .prepare("SELECT * FROM devices ORDER BY last_seen_at DESC")
    .all<DeviceRow>();
  return rows.results.map((row) => deviceFromRow(row, config.offlineAfterMs));
}

export async function getHostedDevice(deviceId: string, config: HostedConfig) {
  await ensureSchema();
  const row = await getDatabase()
    .prepare("SELECT * FROM devices WHERE device = ?")
    .bind(deviceId)
    .first<DeviceRow>();
  return row ? deviceFromRow(row, config.offlineAfterMs) : null;
}

export async function getHostedEvents(
  config: HostedConfig,
  options: { device?: string; limit?: string | number } = {}
) {
  await ensureSchema();
  const parsedLimit = Number.parseInt(String(options.limit ?? 100), 10);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 500);
  const database = getDatabase();
  const query = options.device
    ? "SELECT * FROM events WHERE device = ? ORDER BY received_at DESC LIMIT ?"
    : "SELECT * FROM events ORDER BY received_at DESC LIMIT ?";
  const statement = options.device
    ? database.prepare(query).bind(options.device, limit)
    : database.prepare(query).bind(limit);
  const rows = await statement.all<EventRow>();
  return rows.results.map(eventFromRow);
}
