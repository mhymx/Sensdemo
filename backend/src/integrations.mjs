function asError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

// Cloud integrations can need several seconds for a fresh TLS connection.
// Keep the timeout bounded, but avoid failing healthy first requests too early.
async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function ensurePin(pin) {
  return /^V\d+$/i.test(pin) ? pin.toUpperCase() : null;
}

function eventCodeFor(alert, eventCodes) {
  if (alert.event === "POSSIBLE_SMOKE") return eventCodes.possibleSmoke;
  if (alert.event === "SMOKE_DETECTED") return eventCodes.smokeDetected;
  if (alert.event === "CLEAR") return eventCodes.clear;
  return null;
}

export function createIntegrations(config, { fetchImpl = globalThis.fetch } = {}) {
  const blynkConfigured = Boolean(config.blynk.authToken && fetchImpl);
  const notificationConfigured = Boolean(config.notificationWebhookUrl && fetchImpl);

  async function forwardToBlynk(alert, sendEvent) {
    const baseUrl = config.blynk.baseUrl.replace(/\/+$/, "");
    const updateUrl = new URL(`${baseUrl}/external/api/batch/update`);
    updateUrl.searchParams.set("token", config.blynk.authToken);

    const values = [
      [config.blynk.pins.smoke, alert.smoke],
      [config.blynk.pins.temperature, alert.temperature],
      [config.blynk.pins.humidity, alert.humidity],
      [config.blynk.pins.status, alert.status],
      [config.blynk.pins.wifiRssi, alert.wifi_rssi]
    ];

    for (const [pin, value] of values) {
      const safePin = ensurePin(pin);
      if (safePin && value !== null && value !== undefined) {
        updateUrl.searchParams.set(safePin, String(value));
      }
    }

    const updateResponse = await fetchWithTimeout(fetchImpl, updateUrl, { method: "GET" });
    if (!updateResponse.ok) {
      throw new Error(`Blynk datastream update returned HTTP ${updateResponse.status}`);
    }

    if (!sendEvent) {
      return;
    }

    const code = eventCodeFor(alert, config.blynk.eventCodes);
    if (!code) {
      return;
    }

    const eventUrl = new URL(`${baseUrl}/external/api/logEvent`);
    eventUrl.searchParams.set("token", config.blynk.authToken);
    eventUrl.searchParams.set("code", code);
    eventUrl.searchParams.set(
      "description",
      `${alert.device} ${alert.status}; smoke=${alert.smoke}; room=${alert.room}`
    );

    const eventResponse = await fetchWithTimeout(fetchImpl, eventUrl, { method: "GET" });
    if (!eventResponse.ok) {
      throw new Error(`Blynk event returned HTTP ${eventResponse.status}`);
    }
  }

  async function sendNotification(alert) {
    const response = await fetchWithTimeout(
      fetchImpl,
      config.notificationWebhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SnoopSmoke-Event": alert.event
        },
        body: JSON.stringify({
          type: "snoopsmoke.alert",
          device: alert.device,
          room: alert.room,
          event: alert.event,
          status: alert.status,
          smoke: alert.smoke,
          temperature: alert.temperature,
          humidity: alert.humidity,
          wifi_rssi: alert.wifi_rssi,
          occurred_at: alert.received_at
        })
      }
    );

    if (!response.ok) {
      throw new Error(`notification webhook returned HTTP ${response.status}`);
    }
  }

  return {
    blynkConfigured,
    notificationConfigured,
    async forward(alert, { sendNotificationAlert = false, sendBlynkEvent = false } = {}) {
      const result = {
        blynk: blynkConfigured ? { configured: true, ok: false } : { configured: false, ok: false },
        notification: notificationConfigured
          ? { configured: true, ok: false }
          : { configured: false, ok: false }
      };

      const tasks = [];
      if (blynkConfigured) {
        tasks.push(
          forwardToBlynk(alert, sendBlynkEvent)
            .then(() => {
              result.blynk.ok = true;
            })
            .catch((error) => {
              result.blynk.error = asError(error).message;
            })
        );
      }

      if (sendNotificationAlert && notificationConfigured) {
        tasks.push(
          sendNotification(alert)
            .then(() => {
              result.notification.ok = true;
            })
            .catch((error) => {
              result.notification.error = asError(error).message;
            })
        );
      }

      await Promise.all(tasks);
      return result;
    }
  };
}
