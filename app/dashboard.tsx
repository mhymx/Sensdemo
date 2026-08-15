"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Device = {
  device: string;
  room: string;
  status: string;
  smoke: number | null;
  temperature: number | null;
  humidity: number | null;
  wifi_rssi: number | null;
  lastSeenAt: string;
  lastDetectionAt: string | null;
  online: boolean;
};

type EventRecord = {
  received_at: string;
  device: string;
  room: string;
  event: string;
  smoke: number | null;
  duration_ms: number | null;
  notification_status: string;
};

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) return "—";
  return String(Number(value).toFixed(1)) + suffix;
}

function formatDuration(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const seconds = Math.round(Number(value) / 1000);
  if (seconds < 60) return String(seconds) + "s";
  return String(Math.floor(seconds / 60)) + "m " + String(seconds % 60) + "s";
}

function statusClass(status: string, isOnline: boolean) {
  if (!isOnline) return "offline";
  if (status === "SMOKE DETECTED") return "detected";
  if (status === "POSSIBLE SMOKE") return "warning";
  return "normal";
}

function display(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [online, setOnline] = useState(false);
  const [updated, setUpdated] = useState("Waiting for first refresh");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const responses = await Promise.all([
        fetch("/api/state", { cache: "no-store" }),
        fetch("/api/events?limit=100", { cache: "no-store" }),
      ]);
      if (!responses[0].ok || !responses[1].ok) {
        throw new Error("Hosted backend is unavailable.");
      }
      const state = (await responses[0].json()) as { devices: Device[] };
      const history = (await responses[1].json()) as { events: EventRecord[] };
      setDevices(state.devices);
      setEvents(history.events);
      setOnline(true);
      setError("");
      setUpdated("Updated " + new Date().toLocaleTimeString());
    } catch (refreshError) {
      setOnline(false);
      setError(refreshError instanceof Error ? refreshError.message : "Refresh failed.");
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refresh();
    }, 0);
    const timer = window.setInterval(refresh, 15000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return (
    <main className="shell">
      <nav className="topbar" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">SS</span>
          <span>SnoopSmoke</span>
        </Link>
        <div className="nav">
          <Link href="/">Dashboard</Link>
          <Link href="/diagnostics">Diagnostics</Link>
          <a href="https://blynk.cloud" rel="noreferrer" target="_blank">Blynk</a>
          <a href="https://github.com/mhymx/Sensdemo" rel="noreferrer" target="_blank">GitHub</a>
        </div>
      </nav>

      <header className="page-header">
        <div>
          <p className="eyebrow">SCHOOL RESEARCH PROTOTYPE</p>
          <h1>Smoke and environmental event monitoring.</h1>
          <p className="subtitle">
            A vendor-neutral control room for the ESP32 sensor, Blynk relay, and event history.
            Raw MQ readings are prototype sensor values—not certified ppm or nicotine measurements.
          </p>
        </div>
        <div className={"connection-pill " + (online ? "online" : "offline")}>
          {online ? "BACKEND ONLINE" : "CONNECTING"}
        </div>
      </header>

      {devices.length === 0 ? (
        <section className="empty-state">
          <h2>Waiting for the first device event</h2>
          <p>
            The hosted endpoint is ready. When the ESP32 posts a valid alert, this page will show the device,
            current readings, status, and event history.
          </p>
        </section>
      ) : (
        <section className="device-grid" aria-live="polite">
          {devices.map((device) => (
            <article className={"device-card " + statusClass(device.status, device.online)} key={device.device}>
              <div className="device-heading">
                <div>
                  <h2>{device.device}</h2>
                  <p>Room: {display(device.room)}</p>
                </div>
                <span className="status-badge">{device.online ? device.status : "OFFLINE"}</span>
              </div>
              <div className="metrics">
                <div className="metric"><span className="metric-label">Smoke reading</span><strong>{display(device.smoke)}</strong></div>
                <div className="metric"><span className="metric-label">Temperature</span><strong>{formatNumber(device.temperature, "°C")}</strong></div>
                <div className="metric"><span className="metric-label">Humidity</span><strong>{formatNumber(device.humidity, "%")}</strong></div>
                <div className="metric"><span className="metric-label">Wi-Fi RSSI</span><strong>{device.wifi_rssi === null ? "—" : String(device.wifi_rssi) + " dBm"}</strong></div>
              </div>
              <p className="device-details">
                Last seen: {formatTime(device.lastSeenAt)} · Last detection: {formatTime(device.lastDetectionAt)}
              </p>
            </article>
          ))}
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">AUDIT TRAIL</p>
            <h2>Event history</h2>
          </div>
          <span className="muted">{events.length} event{events.length === 1 ? "" : "s"}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th>Device</th><th>Room</th><th>Event</th><th>Sensor value</th><th>Duration</th><th>Notification</th></tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={7}>No events recorded yet.</td></tr>
              ) : events.map((event) => (
                <tr key={event.received_at + "-" + event.device + "-" + event.event}>
                  <td>{formatTime(event.received_at)}</td>
                  <td>{event.device}</td>
                  <td>{event.room}</td>
                  <td>{event.event}</td>
                  <td>{display(event.smoke)}</td>
                  <td>{formatDuration(event.duration_ms)}</td>
                  <td>{event.notification_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="footer-row">
        <span>Hosted SnoopSmoke software layer · {updated}</span>
        <span className="error">{error}</span>
      </div>
    </main>
  );
}
