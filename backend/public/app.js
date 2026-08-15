const tokenInput = document.querySelector("#dashboard-token");
const connectionPill = document.querySelector("#connection-pill");
const deviceGrid = document.querySelector("#device-grid");
const emptyState = document.querySelector("#empty-state");
const eventsBody = document.querySelector("#events-body");
const eventCount = document.querySelector("#event-count");
const updated = document.querySelector("#updated");
const errorMessage = document.querySelector("#error-message");

tokenInput.value = localStorage.getItem("snoopsmoke_dashboard_token") || "";

function headers() {
  const token = tokenInput.value.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getJson(path) {
  const response = await fetch(path, { headers: headers() });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `Request failed with HTTP ${response.status}`);
  }
  return body;
}

function text(value, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatNumber(value, suffix = "") {
  return value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}${suffix}`;
}

function formatDuration(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return "—";
  const seconds = Math.round(Number(milliseconds) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function statusClass(status, online) {
  if (!online) return "offline";
  if (status === "SMOKE DETECTED") return "detected";
  if (status === "POSSIBLE SMOKE") return "warning";
  return "normal";
}

function makeMetric(label, value) {
  const item = document.createElement("div");
  item.className = "metric";
  const heading = document.createElement("span");
  heading.className = "metric-label";
  heading.textContent = label;
  const reading = document.createElement("strong");
  reading.textContent = value;
  item.append(heading, reading);
  return item;
}

function renderDevices(devices) {
  deviceGrid.replaceChildren();
  emptyState.hidden = devices.length > 0;

  for (const device of devices) {
    const card = document.createElement("article");
    card.className = `device-card ${statusClass(device.status, device.online)}`;

    const heading = document.createElement("div");
    heading.className = "device-heading";
    const title = document.createElement("div");
    const deviceName = document.createElement("h2");
    deviceName.textContent = device.device;
    const room = document.createElement("p");
    room.textContent = `Room: ${text(device.room)}`;
    title.append(deviceName, room);
    const badge = document.createElement("span");
    badge.className = "status-badge";
    badge.textContent = device.online ? device.status : "OFFLINE";
    heading.append(title, badge);

    const metrics = document.createElement("div");
    metrics.className = "metrics";
    metrics.append(
      makeMetric("Smoke reading", text(device.smoke)),
      makeMetric("Temperature", formatNumber(device.temperature, "°C")),
      makeMetric("Humidity", formatNumber(device.humidity, "%")),
      makeMetric("Wi-Fi RSSI", device.wifi_rssi === null ? "—" : `${device.wifi_rssi} dBm`)
    );

    const details = document.createElement("div");
    details.className = "device-details";
    details.textContent = `Last seen: ${formatTime(device.lastSeenAt)} · Last detection: ${formatTime(device.lastDetectionAt)}`;

    card.append(heading, metrics, details);
    deviceGrid.append(card);
  }
}

function renderEvents(events) {
  eventsBody.replaceChildren();
  eventCount.textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;

  for (const event of events) {
    const row = document.createElement("tr");
    const values = [
      formatTime(event.received_at),
      event.device,
      event.room,
      event.event,
      event.smoke,
      formatDuration(event.duration_ms),
      event.notification_status
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = text(value);
      row.append(cell);
    }
    eventsBody.append(row);
  }
}

async function refresh() {
  errorMessage.textContent = "";
  connectionPill.textContent = "Loading…";
  connectionPill.className = "connection-pill";

  try {
    const [state, events] = await Promise.all([getJson("/api/state"), getJson("/api/events?limit=100")]);
    renderDevices(state.devices);
    renderEvents(events.events);
    connectionPill.textContent = "BACKEND ONLINE";
    connectionPill.className = "connection-pill online";
    updated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    connectionPill.textContent = "BACKEND UNAVAILABLE";
    connectionPill.className = "connection-pill offline";
    errorMessage.textContent = error.message;
  }
}

document.querySelector("#save-token").addEventListener("click", () => {
  localStorage.setItem("snoopsmoke_dashboard_token", tokenInput.value.trim());
  refresh();
});
document.querySelector("#refresh").addEventListener("click", refresh);
refresh();
setInterval(refresh, 5000);
