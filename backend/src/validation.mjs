export const EVENT_STATUS = Object.freeze({
  POSSIBLE_SMOKE: "POSSIBLE SMOKE",
  SMOKE_DETECTED: "SMOKE DETECTED",
  CLEAR: "NORMAL"
});

const DEVICE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function optionalNumber(value, field, errors, { min, max, integer = false } = {}) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isFiniteNumber(value) || (integer && !Number.isInteger(value))) {
    errors.push(`${field} must be a finite ${integer ? "integer" : "number"} or null`);
    return null;
  }

  if (min !== undefined && value < min) {
    errors.push(`${field} must be at least ${min}`);
  }

  if (max !== undefined && value > max) {
    errors.push(`${field} must be at most ${max}`);
  }

  return value;
}

export function validateAlert(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, errors: ["request body must be a JSON object"] };
  }

  const device = typeof payload.device === "string" ? payload.device.trim() : "";
  if (!DEVICE_PATTERN.test(device)) {
    errors.push("device must contain 1-64 letters, numbers, dots, underscores, or hyphens");
  }

  const event = typeof payload.event === "string" ? payload.event.trim() : "";
  if (!Object.hasOwn(EVENT_STATUS, event)) {
    errors.push("event must be POSSIBLE_SMOKE, SMOKE_DETECTED, or CLEAR");
  }

  const status = typeof payload.status === "string" ? payload.status.trim() : "";
  if (!Object.values(EVENT_STATUS).includes(status)) {
    errors.push("status must be NORMAL, POSSIBLE SMOKE, or SMOKE DETECTED");
  }

  if (event && Object.hasOwn(EVENT_STATUS, event) && status && EVENT_STATUS[event] !== status) {
    errors.push("event and status do not match");
  }

  const smoke = optionalNumber(payload.smoke, "smoke", errors, {
    min: 0,
    max: 65535,
    integer: true
  });
  const temperature = optionalNumber(payload.temperature, "temperature", errors, {
    min: -40,
    max: 125
  });
  const humidity = optionalNumber(payload.humidity, "humidity", errors, {
    min: 0,
    max: 100
  });
  const wifiRssi = optionalNumber(payload.wifi_rssi, "wifi_rssi", errors, {
    min: -150,
    max: 0,
    integer: true
  });

  if (payload.smoke === undefined || smoke === null) {
    errors.push("smoke is required and must be a raw ADC integer");
  }

  let room = null;
  if (payload.room !== undefined && payload.room !== null) {
    if (typeof payload.room !== "string" || payload.room.trim().length > 64) {
      errors.push("room must be a string of at most 64 characters");
    } else {
      room = payload.room.trim();
    }
  }

  const durationMs = optionalNumber(payload.duration_ms, "duration_ms", errors, {
    min: 0,
    max: 86400000,
    integer: true
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      device,
      event,
      status,
      smoke,
      temperature,
      humidity,
      wifi_rssi: wifiRssi,
      room,
      duration_ms: durationMs
    }
  };
}
