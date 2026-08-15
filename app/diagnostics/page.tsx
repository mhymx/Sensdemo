import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diagnostics | SnoopSmoke",
  description: "Safe ESP32 identity and environment diagnostic instructions for SnoopSmoke.",
};

export default function DiagnosticsPage() {
  return (
    <main className="docs-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">SS</span><span>SnoopSmoke</span></Link>
        <div className="nav"><Link href="/">Dashboard</Link><Link href="/diagnostics">Diagnostics</Link><a href="https://blynk.cloud" rel="noreferrer" target="_blank">Blynk</a></div>
      </nav>

      <article className="docs-content">
        <div>
          <p className="eyebrow">HARDWARE CHECKPOINT</p>
          <h1>ESP32 diagnostics</h1>
          <p className="subtitle">
            Use this utility before the production sensor firmware when the soldered wiring is not yet verified.
          </p>
        </div>

        <section className="info-card">
          <h2>Downloads</h2>
          <ul>
            <li><a className="primary-link" download href="/downloads/SnoopSmoke_Diagnostics.ino">Download diagnostic sketch</a></li>
            <li><a className="secondary-link" download href="/downloads/SnoopSmoke_Diagnostics_Config.h.example">Download diagnostic configuration example</a></li>
          </ul>
        </section>

        <section className="info-card">
          <h2>Safe procedure</h2>
          <ol>
            <li>Disconnect batteries, adapters, and other external supplies.</li>
            <li>Identify the exact ESP32 board marking and photograph its pin labels.</li>
            <li>Confirm that unknown sensor outputs are not driving an ESP32 GPIO above 3.3 V before USB is connected.</li>
            <li>Open the sketch in Arduino IDE and select the matching ESP32 board and COM port.</li>
            <li>Verify, upload, and open Serial Monitor at <code>115200</code> baud.</li>
            <li>Send <code>i</code>, <code>p</code>, and <code>w</code>.</li>
            <li>Do not send <code>a</code> or <code>d</code> until a specific GPIO and safe voltage have been confirmed.</li>
          </ol>
        </section>

        <section className="info-card">
          <h2>What it can and cannot do</h2>
          <ul>
            <li>It identifies the ESP32 chip, revision, CPU, flash, SDK, MAC address, target, and nearby Wi-Fi networks.</li>
            <li>It lists ADC1 candidates for a classic ESP32.</li>
            <li>It cannot infer arbitrary soldered wires or prove that a sensor analog output is voltage-safe.</li>
            <li>It does not detect nicotine or identify a specific substance.</li>
          </ul>
        </section>
      </article>
    </main>
  );
}
