# SnoopSmoke

SnoopSmoke is a school research prototype for detecting possible smoke or
aerosol events with an ESP32, an MQ-series gas sensor, and a DHT11. It reports
raw sensor readings, shows local warnings, sends state-change events over
Wi-Fi, and gives the teacher a dashboard and optional Blynk notifications.

The software layer is hosted and is not tied to one laptop:

- Dashboard: [snoopsmoke-monitor.immafishballl.chatgpt.site](https://snoopsmoke-monitor.immafishballl.chatgpt.site)
- Diagnostics guide and downloads: [ESP32 diagnostics](https://snoopsmoke-monitor.immafishballl.chatgpt.site/diagnostics)
- Source repository: [github.com/mhymx/Sensdemo](https://github.com/mhymx/Sensdemo)

No Node.js installation is needed to open the hosted dashboard. Node.js is
only needed by someone maintaining or rebuilding the software.

## System architecture

~~~mermaid
flowchart LR
    A[Possible smoke or aerosol] --> B[MQ-2 / appropriate sensor]
    B --> C[ESP32]
    C --> D[HTTPS POST /api/alerts]
    D --> E[Hosted SnoopSmoke API]
    E --> F[D1 device and event history]
    E --> G[Blynk relay]
    G --> H[Blynk datastreams and events]
    E --> I[Public dashboard]
    H --> J[Teacher phone notifications]
~~~

The ESP32 speaks only the SnoopSmoke webhook contract. It does not need the
Blynk Arduino library. The hosted API can relay the same payload to Blynk and
the dashboard, so changing the phone-facing app does not require redesigning
the sensor firmware.

## Current status

### VERIFIED

- Public hosted dashboard is live.
- Hosted POST /api/alerts is protected by a device API key.
- Hosted D1 storage keeps current device state, event history, and cooldowns.
- Public GET /api/healthz, GET /api/state, and GET /api/events routes work.
- Invalid or unauthenticated alert requests are rejected.
- A synthetic CLEAR event was accepted by the hosted API and relayed to Blynk
  successfully.
- Blynk template SnoopSmoke contains these datastreams:
  V0 smoke, V1 temperature, V2 humidity, V3 status, and V4 wifi_rssi.
- Blynk contains these event codes:
  possible_smoke, smoke_detected, and clear.
- The diagnostics sketch is downloadable from the hosted site.
- The existing backend test suite passes: 7 tests.
- The hosted site build, TypeScript check, targeted lint, and D1 migration
  generation pass.

### UNTESTED

- The soldered prototype wiring.
- The exact carrier-board pinout around the ESP32-WROOM-32U module.
- MQ module supply voltage and analog-output voltage.
- Physical MQ-2 readings, DHT11 readings, LED, buzzer, and Wi-Fi on the
  prototype.
- Threshold calibration and false-positive behavior.
- A real teacher-phone notification from the physical device.

### ASSUMED / NOT A CLAIM

- GPIO34, GPIO4, GPIO25, and GPIO26 are only the recommended target map.
- The sensor is described as detecting a possible smoke/aerosol event. It does
  not identify nicotine and must not be presented as a nicotine detector.
- MQ readings are raw prototype ADC values, not certified ppm measurements.

## Hosted software

The public site provides:

- / — dashboard with online/offline state, current readings, last detection,
  and event history.
- /diagnostics — beginner-friendly hardware-check procedure and downloads.
- GET /api/healthz — service and Blynk relay status.
- GET /api/state — current device state.
- GET /api/events?limit=100 — event history.
- GET /api/devices/:deviceId — one device.
- POST /api/alerts — authenticated ESP32 ingestion endpoint.

The public read-only dashboard is intentionally simple for a school prototype.
The write endpoint is separate and requires:

~~~http
X-API-Key: YOUR_DEVICE_API_KEY
Content-Type: application/json
~~~

Example payload:

~~~json
{
  "device": "snoopsmoke-01",
  "event": "SMOKE_DETECTED",
  "status": "SMOKE DETECTED",
  "smoke": 842,
  "temperature": 28.4,
  "humidity": 65.0,
  "wifi_rssi": -57
}
~~~

Valid events are POSSIBLE_SMOKE, SMOKE_DETECTED, and CLEAR. A failed DHT11
read is represented by null. The API validates numeric ranges, stores the
event, updates the device card, and applies a five-minute notification
cooldown by default.

The production runtime configuration is stored in the hosting platform as
environment variables. The device API key and Blynk token are not stored in
GitHub, the public site source, or this README.

## Blynk setup and verified mapping

Open [Blynk.Console](https://blynk.cloud) and sign in to the account that owns
the SnoopSmoke template/device. The template has already been configured with:

| Virtual pin | Datastream | Type | Value |
| --- | --- | --- | --- |
| V0 | smoke | Integer | Raw MQ ADC value |
| V1 | temperature | Double | DHT11 degrees Celsius |
| V2 | humidity | Double | DHT11 percent |
| V3 | status | String | NORMAL, POSSIBLE SMOKE, or SMOKE DETECTED |
| V4 | wifi_rssi | Integer | ESP32 RSSI in dBm |

The template events are:

| Event name | Code | Purpose |
| --- | --- | --- |
| Possible Smoke | possible_smoke | Warning event |
| Smoke Detected | smoke_detected | Detection event |
| Clear | clear | Return-to-normal event |

The hosted relay updates the datastreams and logs Blynk events. The relay
limits repeated event logging with the same cooldown used by the dashboard.
Blynk notification preferences still belong to the Blynk account; enable push
notifications for the intended teacher/facilitator and avoid enabling
notifications for routine CLEAR events if the phone should stay quiet.

The Blynk device token is held only as a hosted runtime secret. Do not put it
in the ESP32 sketch or commit it to GitHub.

## Local development and tests

The hosted site is the normal operational path. The original local backend is
still retained for development and test work in backend/.

### Hosted site checks

On Windows, use an installed Node.js 22+ runtime:

~~~powershell
cd C:\path\to\Sensdemo
npm install
npm run db:generate
npm run build
npm run lint
npx tsc --noEmit
~~~

### Existing backend tests

~~~powershell
node --test backend\test\backend.test.mjs
~~~

The local backend uses backend/.env and JSON state under backend/data/. Those
files are ignored by Git. The local backend is useful for simulated tests but
should not be exposed directly to the internet.

## Diagnostics first, hardware last

Use the hosted [diagnostics guide](https://snoopsmoke-monitor.immafishballl.chatgpt.site/diagnostics)
when the prototype is finally available. It provides:

- [Download SnoopSmoke_Diagnostics.ino](https://snoopsmoke-monitor.immafishballl.chatgpt.site/downloads/SnoopSmoke_Diagnostics.ino)
- [Download SnoopSmoke_Diagnostics_Config.h.example](https://snoopsmoke-monitor.immafishballl.chatgpt.site/downloads/SnoopSmoke_Diagnostics_Config.h.example)

The diagnostic firmware prints the board identity, chip family, MAC address,
build target, nearby Wi-Fi networks, and ADC1 candidate pins. It does not
guess arbitrary soldered wires and it does not prove that an unknown analog
signal is voltage-safe.

When the engineer is ready:

1. Disconnect batteries, adapters, and every external power source.
2. Plug only the ESP32 USB cable into the computer.
3. Identify the exact board marking and photograph both sides of the MQ module
   and the ESP32 carrier.
4. In Arduino IDE, install/select the ESP32 board package and the DHT sensor
   library versions described below.
5. Open the downloaded diagnostics sketch.
6. Select the correct ESP32 board and COM port, click Verify, then Upload.
7. Open Serial Monitor at 115200 baud.
8. Send i, p, and w. Do not send a or d until the MQ voltage and DHT data wire
   have been verified.

This ordering intentionally keeps the physical assembly as the final piece.

## Future plug-and-play ESP32 configuration

The production firmware configuration example already contains the hosted
endpoint:

~~~text
SnoopSmoke_Sensor/SnoopSmoke_Config.h.example
~~~

After the wiring is verified, copy it to
SnoopSmoke_Sensor/SnoopSmoke_Config.h and set only:

~~~cpp
#define SNOOPSMOKE_WIFI_SSID "YOUR_WIFI_NAME"
#define SNOOPSMOKE_WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define SNOOPSMOKE_ALERT_API_KEY "THE_PRIVATE_DEVICE_KEY"
~~~

The hosted URL is prefilled. The private API key must be supplied through a
secure channel to the person uploading the firmware; it is intentionally not
published. Pin overrides must remain commented out until the actual wires have
been traced.

Arduino IDE settings for the production sketch:

- Board: select the exact board carrier identified by the engineer. ESP32 Dev
  Module is a common compile target for a classic ESP32-WROOM-32U carrier, but
  it is not proof of the board wiring.
- Port: select the COM port that appears when the ESP32 is connected.
- Serial Monitor: 115200 baud.
- Libraries: DHT sensor library 1.4.7 and Adafruit Unified Sensor 1.1.15.
- ESP32 Arduino core: the repository environment was checked around 3.3.11;
  avoid changing versions during the first hardware test.

The firmware currently samples every two seconds, provides local warning and
detection states, retries Wi-Fi and pending webhooks, and sends state-change
events. Continuous normal telemetry is not yet sent every few seconds; this
can be added later if the dashboard must remain online while the sensor stays
normal.

## Hardware safety and recommended target map

The following is a universal target map, not a confirmed schematic:

| Function | Target GPIO | Prototype connection to verify |
| --- | ---: | --- |
| MQ AO | GPIO34 | MQ module analog output to ADC1 input |
| DHT11 DATA/S | GPIO4 | DHT module data line |
| Alert LED | GPIO26 | GPIO to 220–330 ohm resistor to LED anode; cathode to GND |
| Buzzer | GPIO25 | GPIO to an active-buzzer driver/input |
| Optional button | GPIO27 | Button to GND; reserved for future acknowledgement |

Do not connect the physical circuit based only on this table.

MQ-2/MQ-135 modules often use a 5 V heater and may output an analog voltage
above 3.3 V. Before connecting AO to any ESP32 GPIO:

1. Identify the exact MQ module and labels VCC, GND, AO, and DO.
2. Identify the supply rail actually used by the prototype.
3. Measure the maximum AO voltage with a multimeter.
4. If the module can output 5 V, use a divider before the ESP32 ADC:
   connect a 10 kΩ resistor from AO to the ADC node, and a 20 kΩ resistor
   from the ADC node to GND. A 5 V input then becomes about 3.33 V. Confirm
   the real output and resistor values before powering the GPIO.
5. Join the ESP32 and sensor grounds.

Never connect an unknown 5 V analog output directly to GPIO34. Use a transistor
or suitable driver for a buzzer that draws more current than an ESP32 GPIO can
safely provide.

## Calibration and limitations

MQ sensors react to multiple gases and aerosols. Raw ADC values are prototype
readings only. Do not convert them to ppm without a validated sensor model,
calibration procedure, and reference instrument.

Calibration workflow:

1. Warm the sensor according to its datasheet.
2. Record a clean-air baseline over time.
3. Perform controlled, safe test exposures approved for the project.
4. Record the raw readings and environmental conditions.
5. Choose experimental warning and detection thresholds.
6. Test false positives from temperature, humidity, cleaners, and other gases.
7. Use Possible Smoke or Possible Aerosol/Smoke Event, never nicotine detected,
   unless additional hardware and validation support that claim.

This is not a certified fire alarm, health device, security system, or
nicotine detector.

## Security

Never commit:

- Wi-Fi passwords.
- Blynk auth tokens.
- Device API keys.
- Notification-provider credentials.
- Private local configuration files.

The ignored files backend/.env,
SnoopSmoke_Sensor/SnoopSmoke_Config.h, and
SnoopSmoke_Diagnostics/SnoopSmoke_Diagnostics_Config.h are the intended local
configuration locations. Rotate credentials if they are ever exposed.

## Repository layout

~~~text
backend/                 Local Node backend, relay, and tests
app/                     Hosted dashboard, diagnostics page, and API routes
lib/                     Hosted D1 store, validation adapter, and integrations
db/                      D1/Drizzle schema
drizzle/                 Generated D1 migrations
public/downloads/        Hosted diagnostics downloads
SnoopSmoke_Sensor/       Production ESP32 firmware and config example
SnoopSmoke_Diagnostics/  Conservative board/Wi-Fi diagnostic firmware
~~~
