# SnoopSmoke Sensor

An ESP32-based environmental monitoring prototype that uses an MQ-2 gas/smoke sensor and a DHT11 temperature/humidity sensor. The system is intended to detect smoke/gas conditions and monitor environmental data, with LED and buzzer indicators for alerts.

> ⚠️ **Prototype Status:** The physical hardware setup has not yet been completed. The current sensor code contains placeholder values because the actual ESP32, MQ-2, DHT11, LED, buzzer, and wiring components are not currently available for testing.

I'm unable to do the physical setup since I don’t have the necessary materials or the actual components to work with. You’ll need to handle the physical ESP32 setup and upload the code on your end.

## Sensor Draft

[SnoopSmoke_Sensor.lua](https://github.com/mhymx/Sensdemo/blob/main/SnoopSmoke_Sensor.lua)

* Reads MQ-2 & DHT11
* Placeholder values since prototype isn't present

## Arduino IDE

First, download Arduino IDE:

https://www.arduino.cc/en/software/

## Physical Setup

I also opened up a conversation in case of my absence to guide you, ask questions there and babalikan ko once I'm available so my idea rin ako kung nasa'n kayo.

We need to wire in and establish the components of the breadboard muna:

* ESP32
* MQ-2
* DHT11
* LED
* Buzzer
* Wires
* etc.

[ChatGPT Setup Conversation](https://chatgpt.com/share/6a78a403-f3ec-83ec-a626-1d1e9167b166)

## Step 1 — Add ESP32

1. **File → Preferences**

2. Paste this under **Additional Boards Manager URLs:**

   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`

3. **Tools → Board → Boards Manager**

4. Search `esp32` → Install **esp32 by Espressif Systems**

## Step 2 — Install DHT Library

1. **Sketch → Include Library → Manage Libraries**
2. Search `DHT sensor library`
3. Install **DHT sensor library by Adafruit**
4. Also install **Adafruit Unified Sensor** if prompted

---

# Sensor Code

The current sensor implementation is available here:

[SnoopSmoke_Sensor.lua](https://github.com/mhymx/Sensdemo/blob/main/SnoopSmoke_Sensor.lua)

The code is intended to interface with:

* **MQ-2** — smoke/gas detection
* **DHT11** — temperature and humidity monitoring
* **LED** — visual status/alert indicator
* **Buzzer** — audible alert

> **Important:** The current implementation uses placeholder values because the physical prototype is not yet available. Actual sensor readings will need to be verified once the ESP32 and sensors are wired together.

# Physical Setup

Before uploading and testing the final version of the code, the hardware needs to be assembled on a breadboard.

## Components to Connect

```text
ESP32
 │
 ├── MQ-2 Sensor
 │
 ├── DHT11 Sensor
 │
 ├── LED
 │
 └── Buzzer
```

The ESP32 should provide the required power and ground connections, while the sensor outputs and indicators should be connected to the GPIO pins specified by the code.

# Uploading the Code

Once the physical setup is complete:

1. Connect the ESP32 to the computer using USB.
2. Open the sensor project in Arduino IDE.
3. Select the correct ESP32 board under **Tools → Board**.
4. Select the correct port under **Tools → Port**.
5. Compile the project using **Verify**.
6. If compilation succeeds, click **Upload**.
7. If the ESP32 requires it, press and hold the **BOOT** button during the upload process.
8. Open the **Serial Monitor** to check the sensor output.

# Development Status

| Component         | Status                            |
| ----------------- | --------------------------------- |
| ESP32 code        | 🟡 In progress                    |
| MQ-2 integration  | 🟡 Placeholder / pending hardware |
| DHT11 integration | 🟡 Placeholder / pending hardware |
| LED indicator     | 🟡 Pending hardware               |
| Buzzer            | 🟡 Pending hardware               |
| Breadboard wiring | 🔴 Not yet assembled              |
| Physical testing  | 🔴 Not yet performed              |
| Final prototype   | 🔴 Pending                        |

# Current Limitation

The prototype cannot currently be physically assembled or tested because the required hardware components are unavailable.

The next major step is therefore to:

1. Acquire the required components.
2. Assemble the circuit on a breadboard.
3. Verify the GPIO wiring.
4. Upload the sensor code.
5. Replace placeholder values with real sensor readings.
6. Test the MQ-2 and DHT11 readings.
7. Test the LED and buzzer alert behavior.
8. Debug and calibrate the system based on actual sensor output.

# Next Steps

The immediate priority is physical assembly and testing.

Once the required materials are available, the development process should proceed in this order:

```text
Acquire Components
       ↓
Assemble Breadboard
       ↓
Verify Wiring
       ↓
Configure Arduino IDE
       ↓
Upload ESP32 Code
       ↓
Read MQ-2 / DHT11
       ↓
Test LED + Buzzer
       ↓
Replace Placeholder Values
       ↓
Debug & Calibrate
       ↓
Complete Prototype
```
