import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer } from "../server.mjs";
import { createIntegrations } from "../src/integrations.mjs";
import { StateStore } from "../src/store.mjs";

async function createHarness() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snoopsmoke-test-"));
  const config = {
    host: "127.0.0.1",
    port: 0,
    apiKey: "device-test-key",
    dashboardApiKey: "dashboard-test-key",
    allowInsecureLocal: false,
    roomId: "ROOM-001",
    offlineAfterMs: 300000,
    alertCooldownMs: 300000,
    notifyPossibleSmoke: true,
    notifyClear: false,
    maxEvents: 5000,
    dataFile: path.join(directory, "state.json"),
    notificationWebhookUrl: "",
    blynk: {
      authToken: "",
      baseUrl: "https://blynk.cloud",
      pins: { smoke: "V0", temperature: "V1", humidity: "V2", status: "V3", wifiRssi: "V4" },
      eventCodes: { possibleSmoke: "possible_smoke", smokeDetected: "smoke_detected", clear: "clear" }
    }
  };
  const store = new StateStore(config);
  const calls = [];
  const integrations = {
    blynkConfigured: false,
    notificationConfigured: true,
    async forward(alert, options) {
      calls.push({ alert, options });
      return {
        blynk: { configured: false, ok: false },
        notification: { configured: true, ok: true }
      };
    }
  };
  const server = createServer({ config, store, integrations });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    calls,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      fs.rmSync(directory, { recursive: true, force: true });
    }
  };
}

async function postAlert(baseUrl, body, apiKey = "device-test-key") {
  return fetch(`${baseUrl}/api/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify(body)
  });
}

test("serves the dashboard and public health check", async () => {
  const harness = await createHarness();
  try {
    const dashboard = await fetch(`${harness.baseUrl}/`);
    const html = await dashboard.text();
    assert.equal(dashboard.status, 200);
    assert.match(html, /SnoopSmoke Dashboard/);

    const health = await fetch(`${harness.baseUrl}/healthz`);
    const healthBody = await health.json();
    assert.equal(health.status, 200);
    assert.equal(healthBody.ok, true);
  } finally {
    await harness.close();
  }
});

const detection = {
  device: "snoopsmoke-01",
  event: "SMOKE_DETECTED",
  status: "SMOKE DETECTED",
  smoke: 842,
  temperature: 28.4,
  humidity: 65,
  wifi_rssi: -57
};

test("rejects an alert without the device API key", async () => {
  const harness = await createHarness();
  try {
    const response = await postAlert(harness.baseUrl, detection, "wrong-key");
    assert.equal(response.status, 401);
  } finally {
    await harness.close();
  }
});

test("rejects invalid event/status combinations", async () => {
  const harness = await createHarness();
  try {
    const response = await postAlert(harness.baseUrl, {
      ...detection,
      event: "CLEAR",
      status: "SMOKE DETECTED"
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.details.join(" "), /do not match/);
  } finally {
    await harness.close();
  }
});

test("accepts a detection, stores it, and forwards it once", async () => {
  const harness = await createHarness();
  try {
    const response = await postAlert(harness.baseUrl, detection);
    const body = await response.json();
    assert.equal(response.status, 202);
    assert.equal(body.accepted, true);
    assert.equal(harness.calls.length, 1);
    assert.equal(harness.calls[0].options.sendNotificationAlert, true);
    assert.equal(harness.calls[0].options.sendBlynkEvent, true);

    const stateResponse = await fetch(`${harness.baseUrl}/api/state`, {
      headers: { Authorization: "Bearer dashboard-test-key" }
    });
    const state = await stateResponse.json();
    assert.equal(state.devices[0].device, "snoopsmoke-01");
    assert.equal(state.devices[0].status, "SMOKE DETECTED");
    assert.equal(state.devices[0].room, "ROOM-001");
  } finally {
    await harness.close();
  }
});

test("suppresses repeated detection notifications during cooldown but keeps history", async () => {
  const harness = await createHarness();
  try {
    await postAlert(harness.baseUrl, detection);
    const response = await postAlert(harness.baseUrl, detection);
    const body = await response.json();
    assert.equal(response.status, 202);
    assert.equal(body.notification_suppressed, true);
    assert.equal(harness.calls.length, 2);
    assert.equal(harness.calls[0].options.sendNotificationAlert, true);
    assert.equal(harness.calls[0].options.sendBlynkEvent, true);
    assert.equal(harness.calls[1].options.sendNotificationAlert, false);
    assert.equal(harness.calls[1].options.sendBlynkEvent, false);

    const eventsResponse = await fetch(`${harness.baseUrl}/api/events?limit=10`, {
      headers: { "X-API-Key": "dashboard-test-key" }
    });
    const events = await eventsResponse.json();
    assert.equal(events.events.length, 2);
    assert.equal(events.events[0].notification_status, "suppressed");
  } finally {
    await harness.close();
  }
});

test("handles CLEAR and requires dashboard authentication", async () => {
  const harness = await createHarness();
  try {
    const unauthorized = await fetch(`${harness.baseUrl}/api/state`);
    assert.equal(unauthorized.status, 401);

    await postAlert(harness.baseUrl, detection);
    const response = await postAlert(harness.baseUrl, {
      device: "snoopsmoke-01",
      event: "CLEAR",
      status: "NORMAL",
      smoke: 120,
      temperature: null,
      humidity: null,
      wifi_rssi: -58
    });
    assert.equal(response.status, 202);
    assert.equal(harness.calls.at(-1).options.sendNotificationAlert, false);
    assert.equal(harness.calls.at(-1).options.sendBlynkEvent, true);

    const stateResponse = await fetch(`${harness.baseUrl}/api/state`, {
      headers: { "X-API-Key": "dashboard-test-key" }
    });
    const state = await stateResponse.json();
    assert.equal(state.devices[0].event, "CLEAR");
    assert.equal(state.devices[0].status, "NORMAL");
  } finally {
    await harness.close();
  }
});

test("builds the optional Blynk relay requests without exposing secrets in the payload", async () => {
  const requests = [];
  const fakeFetch = async (url) => {
    requests.push(String(url));
    return { ok: true, status: 200 };
  };
  const integrations = createIntegrations(
    {
      notificationWebhookUrl: "",
      blynk: {
        authToken: "test-token",
        baseUrl: "https://blynk.example",
        pins: { smoke: "V0", temperature: "V1", humidity: "V2", status: "V3", wifiRssi: "V4" },
        eventCodes: { possibleSmoke: "possible_smoke", smokeDetected: "smoke_detected", clear: "clear" }
      }
    },
    { fetchImpl: fakeFetch }
  );

  await integrations.forward({
    ...detection,
    room: "ROOM-001",
    received_at: "2026-08-15T00:00:00.000Z"
  }, { sendBlynkEvent: true });

  assert.equal(requests.length, 2);
  assert.match(requests[0], /external\/api\/batch\/update/);
  assert.match(requests[1], /external\/api\/logEvent/);
  assert.match(requests[1], /code=smoke_detected/);
  assert.match(requests[0], /token=test-token/);
});
