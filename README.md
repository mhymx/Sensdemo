# SnoopSmoke Sensor

SnoopSmoke is an ESP32-based smoke and environmental alert prototype. It reads an MQ-series gas/smoke sensor and a DHT11, activates local indicators, and can forward state-change alerts over Wi-Fi to either a custom app or a Blynk integration.

```mermaid
flowchart LR
    A[Smoke or vape] --> B[MQ-2 / MQ-135]
    B --> C[ESP32]
    C --> D[Local LED and buzzer]
    C --> E[Wi-Fi]
    E --> F[Webhook or Blynk bridge]
    F --> G[Teacher's phone app]
    G --> H[Push notification]
```

## Important: what the photos confirm

The attached photos appear to show a classic ESP32 DevKit-style board, an MQ-series sensor, a blue DHT11 module, a buzzer, a pushbutton, and a perfboard. They do not make the GPIO labels or every soldered wire unambiguous.

Therefore:

- The pin map below is a recommended universal target for a classic ESP32 DevKit-style board, not a claim about the existing solder joints.
- Do not energize the board until each wire is traced with a multimeter or continuity tester.
- If the physical board is an ESP32-S3, C3, or another variant, verify its pinout before using these defaults.

## Recommended universal pin contract

The firmware defaults are in `SnoopSmoke_Sensor/SnoopSmoke_Sensor.ino` and can be overridden in the ignored local `SnoopSmoke_Sensor/SnoopSmoke_Config.h` file.

| Function | ESP32 GPIO | Connection | Notes |
| --- | ---: | --- | --- |
| MQ-2/MQ-135 analog output | 34 | Sensor `AO` → GPIO34 | ADC1, input-only on classic ESP32; keep the analog signal at or below the ESP32-safe voltage. |
| DHT11 data | 4 | Module `S`/`DATA` → GPIO4 | Power the common 3-pin module from 3.3 V. A bare DHT11 needs a pull-up resistor. |
| Alert LED | 26 | GPIO26 → 220–330 Ω resistor → LED anode | LED cathode to GND. External LED is preferred over a board-specific built-in LED. |
| Active buzzer | 25 | GPIO25 → buzzer driver/input | Use a transistor or suitable driver if the buzzer draws more current than an ESP32 GPIO can supply. |
| Optional acknowledge button | 27 | GPIO27 → pushbutton → GND | Reserved for a future mute/acknowledge feature; firmware currently does not require it. |
| Common ground | GND | All modules and supplies share GND | A shared ground is required for reliable readings. |

### Power and voltage safety

1. MQ-2 and MQ-135 modules commonly need a 5 V heater supply. Do not assume the ESP32 3.3 V pin can power the heater.
2. A 5 V-powered MQ module may produce an analog output above 3.3 V. Use a voltage divider or a level-safe sensor board before connecting `AO` to GPIO34. For a nominal 5 V signal, a 10 kΩ high-side resistor and 20 kΩ low-side resistor gives approximately 3.3 V at the ESP32 input; confirm the actual module output with a meter.
3. Power the DHT11 logic from 3.3 V unless the exact module datasheet says otherwise.
4. Do not connect an unknown 5 V signal directly to an ESP32 GPIO.
5. Use ADC1 pins for analog sensors when Wi-Fi is enabled. On the classic ESP32, ADC2 is shared with Wi-Fi and can fail while Wi-Fi is active. [Espressif ADC guidance](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/adc.html)

## Firmware behavior

The current sketch:

- Samples the MQ sensor and DHT11 every two seconds.
- Reports `NORMAL`, `POSSIBLE SMOKE`, or `SMOKE DETECTED`.
- Turns on the alert LED for warning/detection and the active buzzer for detection.
- Detects failed DHT reads and sends `null` rather than `nan` in JSON.
- Reconnects to Wi-Fi without stopping local monitoring.
- Sends an alert only when the smoke state changes, then retries a pending alert if the network is unavailable.
- Sends no cloud data until a local webhook URL is configured.

### Configure Wi-Fi without committing secrets

1. Copy `SnoopSmoke_Sensor/SnoopSmoke_Config.h.example` to `SnoopSmoke_Sensor/SnoopSmoke_Config.h`.
2. Fill in the Wi-Fi SSID and password.
3. Set `SNOOPSMOKE_ALERT_WEBHOOK_URL` to the HTTPS endpoint for the selected app path.
4. Optionally set `SNOOPSMOKE_ALERT_API_KEY`.
5. Change the pin overrides only after the wiring has been traced.

`SnoopSmoke_Config.h` is ignored by Git. Never commit Wi-Fi passwords, Blynk device tokens, or API keys.

### Alert payload

The firmware sends a JSON `POST` on a state change:

```json
{
  "device": "snoopsmoke-01",
  "event": "SMOKE_DETECTED",
  "status": "SMOKE DETECTED",
  "smoke": 842,
  "temperature": 28.4,
  "humidity": 65.0,
  "wifi_rssi": -57
}
```

Possible events are `POSSIBLE_SMOKE`, `SMOKE_DETECTED`, and `CLEAR`. DHT values are `null` when a read fails.

## Choose the phone-alert path

The sensor firmware uses a vendor-neutral webhook so the hardware does not need to be rewritten when the phone app changes.

### Option A: Blynk

Use a small HTTPS relay that accepts the SnoopSmoke JSON, writes the readings to Blynk datastreams, and triggers a Blynk event for `POSSIBLE_SMOKE` or `SMOKE_DETECTED`.

Suggested datastreams:

| Datastream | Type | Meaning |
| --- | --- | --- |
| `smoke` | Integer | Raw calibrated MQ reading |
| `temperature` | Double | DHT11 temperature in °C |
| `humidity` | Double | DHT11 relative humidity |
| `status` | String | Current state |
| `wifi_rssi` | Integer | ESP32 Wi-Fi signal level |

Create Blynk Events for the warning and detected states, then enable push notifications for the intended recipients. Blynk documents datastreams and event-based notifications in its [Datastream documentation](https://docs.blynk.io/en/blynk.console/templates/datastreams) and [Notifications documentation](https://docs.blynk.io/en/getting-started/notification-management).

### Option B: our own app

Implement `POST /api/alerts` in the app backend. The endpoint should:

1. Verify `X-API-Key`.
2. Validate `device`, `event`, and numeric ranges.
3. Store the latest telemetry and event history.
4. Send a push notification only for `SMOKE_DETECTED` and optionally `POSSIBLE_SMOKE`.
5. Rate-limit repeated events and provide a `CLEAR` notification/state.

Wi-Fi only connects the ESP32 to the network. Push notifications require the endpoint to be reachable and an app notification service to be configured.

## Calibration and testing sequence

The MQ threshold values are raw ADC values, not certified ppm values and not a reliable way to identify a specific substance. MQ-2/MQ-135 sensors respond to multiple gases and require warm-up and calibration.

1. Verify the exact ESP32 model and trace every wire.
2. Power the MQ module safely and confirm the analog voltage with a multimeter.
3. Upload with the webhook URL empty first.
4. Open Serial Monitor at `115200` baud.
5. Allow the MQ sensor to warm up according to its datasheet.
6. Record clean-air readings and controlled test readings.
7. Set warning and detection thresholds in the local config or sketch.
8. Test the LED/buzzer locally before enabling cloud notifications.
9. Enable the webhook and verify one warning, one detection, and one clear event.
10. Test Wi-Fi loss and recovery before relying on the system for supervision.

This is a prototype alert system, not a certified fire, health, or security alarm. It cannot reliably distinguish smoke from vape aerosol without additional sensing, calibration, and testing.

## Compile and upload

The sketch is an Arduino project in `SnoopSmoke_Sensor/`.

With Arduino CLI:

```text
arduino-cli compile --fqbn esp32:esp32:esp32 SnoopSmoke_Sensor
arduino-cli upload -p YOUR_PORT --fqbn esp32:esp32:esp32 SnoopSmoke_Sensor
```

With Arduino IDE, open `SnoopSmoke_Sensor/SnoopSmoke_Sensor.ino`, select the matching ESP32 board and port, click Verify, then Upload. Open Serial Monitor at `115200` baud.

The last verified build used ESP32 core `3.3.11`, DHT sensor library `1.4.7`, and Adafruit Unified Sensor `1.1.15`.

## Project status

| Area | Status |
| --- | --- |
| ESP32 local sensor firmware | Implemented |
| DHT11 failure handling | Implemented |
| Wi-Fi reconnect | Implemented |
| Vendor-neutral webhook payload | Implemented, endpoint still to be selected |
| Universal target pin map | Documented, not yet verified against the soldered board |
| Blynk relay/app | Pending choice and credentials |
| Custom teacher app | Pending backend/app endpoint |
| MQ calibration | Pending physical warm-up/testing |
| Hardware runtime test | Pending verified wiring and board access |

## References

- [Arduino ESP32 Wi-Fi API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/wifi.html)
- [Arduino ESP32 ADC API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html)
- [Blynk datastreams](https://docs.blynk.io/en/blynk.console/templates/datastreams)
- [Blynk events and notifications](https://docs.blynk.io/en/blynk.console/templates/events)
