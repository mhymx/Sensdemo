import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function iso(timestamp) {
  return new Date(timestamp).toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class StateStore {
  constructor({ filePath, dataFile, roomId, offlineAfterMs, maxEvents = 5000, now = () => Date.now() }) {
    this.filePath = filePath || dataFile;
    this.roomId = roomId;
    this.offlineAfterMs = offlineAfterMs;
    this.maxEvents = maxEvents;
    this.now = now;
    this.state = {
      devices: {},
      events: [],
      notificationHistory: {}
    };
    this.load();
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const loaded = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (loaded && typeof loaded === "object") {
        this.state = {
          devices: loaded.devices && typeof loaded.devices === "object" ? loaded.devices : {},
          events: Array.isArray(loaded.events) ? loaded.events : [],
          notificationHistory:
            loaded.notificationHistory && typeof loaded.notificationHistory === "object"
              ? loaded.notificationHistory
              : {}
        };
      }
    } catch (error) {
      throw new Error(`Unable to read ${this.filePath}: ${error.message}`);
    }
  }

  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryPath, this.filePath);
  }

  recordAlert(alert, { alertCooldownMs, notifyPossibleSmoke, notifyClear }) {
    const now = this.now();
    const receivedAt = iso(now);
    const previous = this.state.devices[alert.device];
    const room = alert.room || previous?.room || this.roomId;
    const statusChanged = !previous || previous.status !== alert.status;
    const previousStartedAt = previous?.statusStartedAt ? Date.parse(previous.statusStartedAt) : NaN;
    const calculatedDuration = Number.isFinite(previousStartedAt) ? Math.max(0, now - previousStartedAt) : null;
    const durationMs = alert.duration_ms ?? (statusChanged ? calculatedDuration : 0);
    const notificationKey = `${alert.device}:${alert.event}`;
    const lastNotificationAt = this.state.notificationHistory[notificationKey] || 0;
    const notificationCandidate =
      alert.event === "SMOKE_DETECTED" ||
      (alert.event === "POSSIBLE_SMOKE" && notifyPossibleSmoke) ||
      (alert.event === "CLEAR" && notifyClear);
    const notificationSuppressed =
      notificationCandidate && lastNotificationAt > 0 && now - lastNotificationAt < alertCooldownMs;
    const shouldNotify = notificationCandidate && !notificationSuppressed;
    const blynkEventKey = `blynk:${notificationKey}`;
    const lastBlynkEventAt = this.state.notificationHistory[blynkEventKey] || 0;
    const blynkEventSuppressed =
      lastBlynkEventAt > 0 && now - lastBlynkEventAt < alertCooldownMs;
    const shouldBlynkEvent = !blynkEventSuppressed;

    const eventRecord = {
      id: crypto.randomUUID(),
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
        : "not_requested"
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
        alert.event === "SMOKE_DETECTED" ? receivedAt : previous?.lastDetectionAt || null,
      statusStartedAt: statusChanged ? receivedAt : previous?.statusStartedAt || receivedAt,
      online: true
    };

    this.state.devices[alert.device] = deviceState;
    this.state.events.unshift(eventRecord);
    this.state.events = this.state.events.slice(0, this.maxEvents);

    if (shouldNotify) {
      // Reserve the cooldown before calling external services so concurrent requests cannot spam them.
      this.state.notificationHistory[notificationKey] = now;
    }

    if (shouldBlynkEvent) {
      this.state.notificationHistory[blynkEventKey] = now;
    }

    this.persist();

    return {
      event: clone(eventRecord),
      device: clone(deviceState),
      shouldNotify,
      notificationCandidate,
      notificationSuppressed,
      shouldBlynkEvent,
      blynkEventSuppressed
    };
  }

  completeNotification(eventId, { configured, ok, error }) {
    const event = this.state.events.find((item) => item.id === eventId);
    if (!event || event.notification_status === "suppressed" || event.notification_status === "not_requested") {
      return;
    }

    if (!configured) {
      event.notification_status = "not_configured";
    } else if (ok) {
      event.notification_status = "sent";
    } else {
      event.notification_status = "failed";
      event.notification_error = String(error || "notification provider failed").slice(0, 240);
    }

    this.persist();
  }

  getDevices() {
    const now = this.now();
    return Object.values(this.state.devices).map((device) => ({
      ...clone(device),
      online: now - Date.parse(device.lastSeenAt) <= this.offlineAfterMs
    }));
  }

  getDevice(deviceId) {
    const device = this.state.devices[deviceId];
    if (!device) {
      return null;
    }

    return {
      ...clone(device),
      online: this.now() - Date.parse(device.lastSeenAt) <= this.offlineAfterMs
    };
  }

  getEvents({ device, limit = 100 } = {}) {
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 500);
    return this.state.events
      .filter((event) => !device || event.device === device)
      .slice(0, safeLimit)
      .map(clone);
  }
}
