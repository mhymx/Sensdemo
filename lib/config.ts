import { env } from "cloudflare:workers";

export type HostedConfig = {
  apiKey: string;
  dashboardApiKey: string;
  roomId: string;
  offlineAfterMs: number;
  alertCooldownMs: number;
  notifyPossibleSmoke: boolean;
  notifyClear: boolean;
  notificationWebhookUrl: string;
  blynk: {
    authToken: string;
    baseUrl: string;
    pins: {
      smoke: string;
      temperature: string;
      humidity: string;
      status: string;
      wifiRssi: string;
    };
    eventCodes: {
      possibleSmoke: string;
      smokeDetected: string;
      clear: string;
    };
  };
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number.parseInt(clean(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function value(name: string) {
  const runtimeEnv = env as unknown as Record<string, unknown>;
  return runtimeEnv[name];
}

export function getHostedConfig(): HostedConfig {
  return {
    apiKey: clean(value("SNOOPSMOKE_DEVICE_API_KEY")),
    dashboardApiKey: clean(value("SNOOPSMOKE_DASHBOARD_API_KEY")),
    roomId: clean(value("SNOOPSMOKE_ROOM_ID")) || "ROOM-001",
    offlineAfterMs: numberValue(value("SNOOPSMOKE_OFFLINE_AFTER_MS"), 300000),
    alertCooldownMs: numberValue(value("SNOOPSMOKE_ALERT_COOLDOWN_MS"), 300000),
    notifyPossibleSmoke: booleanValue(value("SNOOPSMOKE_NOTIFY_POSSIBLE_SMOKE"), true),
    notifyClear: booleanValue(value("SNOOPSMOKE_NOTIFY_CLEAR"), false),
    notificationWebhookUrl: clean(value("SNOOPSMOKE_NOTIFICATION_WEBHOOK_URL")),
    blynk: {
      authToken: clean(value("BLYNK_AUTH_TOKEN")),
      baseUrl: clean(value("BLYNK_BASE_URL")) || "https://blynk.cloud",
      pins: {
        smoke: clean(value("BLYNK_VPIN_SMOKE")) || "V0",
        temperature: clean(value("BLYNK_VPIN_TEMPERATURE")) || "V1",
        humidity: clean(value("BLYNK_VPIN_HUMIDITY")) || "V2",
        status: clean(value("BLYNK_VPIN_STATUS")) || "V3",
        wifiRssi: clean(value("BLYNK_VPIN_WIFI_RSSI")) || "V4",
      },
      eventCodes: {
        possibleSmoke: clean(value("BLYNK_EVENT_POSSIBLE_SMOKE")) || "possible_smoke",
        smokeDetected: clean(value("BLYNK_EVENT_SMOKE_DETECTED")) || "smoke_detected",
        clear: clean(value("BLYNK_EVENT_CLEAR")) || "clear",
      },
    },
  };
}

export function providedApiKey(request: Request) {
  const direct = request.headers.get("X-API-Key");
  if (direct) return direct;

  const authorization = request.headers.get("Authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export function isDeviceAuthorized(request: Request, config: HostedConfig) {
  return Boolean(config.apiKey) && providedApiKey(request) === config.apiKey;
}

export function isDashboardAuthorized(request: Request, config: HostedConfig) {
  return !config.dashboardApiKey || providedApiKey(request) === config.dashboardApiKey;
}

