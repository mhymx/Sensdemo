import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function loadDotEnv(filePath = path.join(BACKEND_DIR, ".env"), target = process.env) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    if (target[key] === undefined) {
      target[key] = value;
    }
  }
}

export function readConfig(env = process.env) {
  const dataFile = env.SNOOPSMOKE_DATA_FILE
    ? path.resolve(env.SNOOPSMOKE_DATA_FILE)
    : path.join(BACKEND_DIR, "data", "state.json");

  return {
    host: clean(env.SNOOPSMOKE_HOST) || "127.0.0.1",
    port: parseInteger(env.PORT ?? env.SNOOPSMOKE_PORT, 8787),
    apiKey: clean(env.SNOOPSMOKE_DEVICE_API_KEY),
    dashboardApiKey: clean(env.SNOOPSMOKE_DASHBOARD_API_KEY),
    allowInsecureLocal: parseBoolean(env.SNOOPSMOKE_ALLOW_INSECURE_LOCAL, false),
    roomId: clean(env.SNOOPSMOKE_ROOM_ID) || "ROOM-001",
    offlineAfterMs: parseInteger(env.SNOOPSMOKE_OFFLINE_AFTER_MS, 300000),
    alertCooldownMs: parseInteger(env.SNOOPSMOKE_ALERT_COOLDOWN_MS, 300000),
    notifyPossibleSmoke: parseBoolean(env.SNOOPSMOKE_NOTIFY_POSSIBLE_SMOKE, true),
    notifyClear: parseBoolean(env.SNOOPSMOKE_NOTIFY_CLEAR, false),
    maxEvents: parseInteger(env.SNOOPSMOKE_MAX_EVENTS, 5000),
    dataFile,
    notificationWebhookUrl: clean(env.SNOOPSMOKE_NOTIFICATION_WEBHOOK_URL),
    blynk: {
      authToken: clean(env.BLYNK_AUTH_TOKEN),
      baseUrl: clean(env.BLYNK_BASE_URL) || "https://blynk.cloud",
      pins: {
        smoke: clean(env.BLYNK_VPIN_SMOKE) || "V0",
        temperature: clean(env.BLYNK_VPIN_TEMPERATURE) || "V1",
        humidity: clean(env.BLYNK_VPIN_HUMIDITY) || "V2",
        status: clean(env.BLYNK_VPIN_STATUS) || "V3",
        wifiRssi: clean(env.BLYNK_VPIN_WIFI_RSSI) || "V4"
      },
      eventCodes: {
        possibleSmoke: clean(env.BLYNK_EVENT_POSSIBLE_SMOKE) || "possible_smoke",
        smokeDetected: clean(env.BLYNK_EVENT_SMOKE_DETECTED) || "smoke_detected",
        clear: clean(env.BLYNK_EVENT_CLEAR) || "clear"
      }
    }
  };
}

export { BACKEND_DIR };
