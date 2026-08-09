# SnoopSmoke Sensor

An ESP32-based environmental monitoring prototype that uses an MQ-2 gas/smoke sensor and a DHT11 temperature/humidity sensor. The system is intended to detect smoke/gas conditions and monitor environmental data, with LED and buzzer indicators for alerts.

> ⚠️ Prototype Status: The physical hardware setup has not yet been completed. The current sensor code contains placeholder values because the actual ESP32, MQ-2, DHT11, LED, buzzer, and wiring components are not currently available for testing.

I can’t do the physical setup since I don’t have the materials or the actual components to work with. You’ll need to handle the physical ESP32 setup and upload the code on your end.

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

(https://chatgpt.com/share/6a78a403-f3ec-83ec-a626-1d1e9167b166)

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
