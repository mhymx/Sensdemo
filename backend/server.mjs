import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv, readConfig } from "./src/config.mjs";
import { createIntegrations } from "./src/integrations.mjs";
import { StateStore } from "./src/store.mjs";
import { validateAlert } from "./src/validation.mjs";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(SERVER_DIR, "public");

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload)
  });
  response.end(payload);
}

function sendText(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function getProvidedKey(request, headerName) {
  const direct = request.headers[headerName.toLowerCase()];
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  const authorization = request.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  return "";
}

function isAuthorized(request, expectedKey, allowWhenEmpty = false) {
  if (!expectedKey) {
    return allowWhenEmpty;
  }

  return getProvidedKey(request, "x-api-key") === expectedKey;
}

function readJson(request, maxBytes = 32768) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("request body is too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : null);
      } catch {
        reject(new Error("request body must be valid JSON"));
      }
    });

    request.on("error", reject);
  });
}

function serveStatic(response, pathname) {
  const fileName = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^[A-Za-z0-9._-]+$/.test(fileName)) {
    sendJson(response, 404, { error: "not found" });
    return;
  }

  const filePath = path.join(PUBLIC_DIR, fileName);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
    sendJson(response, 404, { error: "not found" });
    return;
  }

  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  };
  sendText(response, 200, fs.readFileSync(filePath), types[path.extname(filePath)] || "application/octet-stream");
}

export function createServer({ config, store, integrations } = {}) {
  if (!config) {
    throw new Error("config is required");
  }

  if (!config.apiKey && !config.allowInsecureLocal) {
    throw new Error("SNOOPSMOKE_DEVICE_API_KEY is required; use SNOOPSMOKE_ALLOW_INSECURE_LOCAL=true only for local testing");
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!config.dashboardApiKey && !localHosts.has(config.host) && !config.allowInsecureLocal) {
    throw new Error("SNOOPSMOKE_DASHBOARD_API_KEY is required when the backend is not bound to localhost");
  }

  const stateStore = store || new StateStore(config);
  const externalIntegrations = integrations || createIntegrations(config);

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

      if (request.method === "OPTIONS") {
        response.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        });
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/healthz") {
        sendJson(response, 200, {
          ok: true,
          service: "snoopsmoke-backend",
          time: new Date().toISOString(),
          blynk_configured: externalIntegrations.blynkConfigured,
          notification_configured: externalIntegrations.notificationConfigured
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/alerts") {
        if (!isAuthorized(request, config.apiKey, config.allowInsecureLocal)) {
          sendJson(response, 401, { error: "unauthorized device" });
          return;
        }

        let payload;
        try {
          payload = await readJson(request);
        } catch (error) {
          sendJson(response, 400, { error: error.message });
          return;
        }

        const validation = validateAlert(payload);
        if (!validation.ok) {
          sendJson(response, 400, { error: "invalid alert payload", details: validation.errors });
          return;
        }

        const recorded = stateStore.recordAlert(validation.value, {
          alertCooldownMs: config.alertCooldownMs,
          notifyPossibleSmoke: config.notifyPossibleSmoke,
          notifyClear: config.notifyClear
        });

        const integrationResult = await externalIntegrations.forward(recorded.event, {
          sendNotificationAlert: recorded.shouldNotify,
          sendBlynkEvent: recorded.shouldBlynkEvent
        });

        const notificationResult = integrationResult.notification;
        stateStore.completeNotification(recorded.event.id, {
          configured: notificationResult.configured,
          ok: notificationResult.ok,
          error: notificationResult.error
        });

        sendJson(response, 202, {
          accepted: true,
          event_id: recorded.event.id,
          notification_suppressed: recorded.notificationSuppressed,
          integrations: integrationResult
        });
        return;
      }

      const dashboardAuthorized = isAuthorized(
        request,
        config.dashboardApiKey,
        !config.dashboardApiKey
      );

      if (url.pathname.startsWith("/api/") && !dashboardAuthorized) {
        sendJson(response, 401, { error: "unauthorized dashboard request" });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/state") {
        sendJson(response, 200, {
          generated_at: new Date().toISOString(),
          offline_after_ms: config.offlineAfterMs,
          devices: stateStore.getDevices()
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/events") {
        sendJson(response, 200, {
          events: stateStore.getEvents({
            device: url.searchParams.get("device") || undefined,
            limit: url.searchParams.get("limit") || 100
          })
        });
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/devices/")) {
        const deviceId = decodeURIComponent(url.pathname.slice("/api/devices/".length));
        const device = stateStore.getDevice(deviceId);
        if (!device) {
          sendJson(response, 404, { error: "device not found" });
          return;
        }
        sendJson(response, 200, device);
        return;
      }

      if (request.method === "GET") {
        serveStatic(response, url.pathname);
        return;
      }

      sendJson(response, 404, { error: "not found" });
    } catch (error) {
      console.error(error);
      if (!response.headersSent) {
        sendJson(response, 500, { error: "internal server error" });
      } else {
        response.destroy();
      }
    }
  });
}

export async function start() {
  loadDotEnv();
  const config = readConfig();
  const server = createServer({ config });
  await new Promise((resolve) => server.listen(config.port, config.host, resolve));
  console.log(`SnoopSmoke backend listening at http://${config.host}:${config.port}`);
  console.log(`Dashboard: http://${config.host}:${config.port}/`);
  console.log(`Blynk relay: ${config.blynk.authToken ? "configured" : "not configured"}`);
  console.log(`Notification webhook: ${config.notificationWebhookUrl ? "configured" : "not configured"}`);
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
