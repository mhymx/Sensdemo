#include <DHT.h>
#include <WiFi.h>

// Copy SnoopSmoke_Diagnostics_Config.h.example to
// SnoopSmoke_Diagnostics_Config.h only after the engineer confirms the board
// and verifies that candidate GPIOs cannot receive more than 3.3 V.
#if defined(__has_include)
#if __has_include("SnoopSmoke_Diagnostics_Config.h")
#include "SnoopSmoke_Diagnostics_Config.h"
#endif
#endif

#ifndef SNOOPSMOKE_DIAG_ENABLE_PIN_SCAN
#define SNOOPSMOKE_DIAG_ENABLE_PIN_SCAN 0
#endif

#ifndef SNOOPSMOKE_DIAG_DHT_PIN
#define SNOOPSMOKE_DIAG_DHT_PIN -1
#endif

#ifndef SNOOPSMOKE_DIAG_DHT_TYPE
#define SNOOPSMOKE_DIAG_DHT_TYPE DHT11
#endif

#if SNOOPSMOKE_DIAG_DHT_PIN >= 0
DHT diagnosticDht(SNOOPSMOKE_DIAG_DHT_PIN, SNOOPSMOKE_DIAG_DHT_TYPE);
#endif

void printHelp();

void printIdentity() {
  Serial.println();
  Serial.println("=== SNOOPSMOKE DIAGNOSTICS ===");
  Serial.print("Chip model: ");
  Serial.println(ESP.getChipModel());
  Serial.print("Chip revision: ");
  Serial.println(ESP.getChipRevision());
  Serial.print("CPU MHz: ");
  Serial.println(ESP.getCpuFreqMHz());
  Serial.print("Flash bytes: ");
  Serial.println(ESP.getFlashChipSize());
  Serial.print("Free heap: ");
  Serial.println(ESP.getFreeHeap());
  Serial.print("SDK: ");
  Serial.println(ESP.getSdkVersion());
  Serial.print("Wi-Fi MAC: ");
  Serial.println(WiFi.macAddress());

#ifdef ARDUINO_FQBN
  Serial.print("Compiled FQBN: ");
  Serial.println(ARDUINO_FQBN);
#else
  Serial.println("Compiled FQBN: unavailable");
#endif

#if CONFIG_IDF_TARGET_ESP32
  Serial.println("Target family: classic ESP32");
#elif CONFIG_IDF_TARGET_ESP32S2
  Serial.println("Target family: ESP32-S2");
#elif CONFIG_IDF_TARGET_ESP32S3
  Serial.println("Target family: ESP32-S3");
#elif CONFIG_IDF_TARGET_ESP32C3
  Serial.println("Target family: ESP32-C3");
#elif CONFIG_IDF_TARGET_ESP32C6
  Serial.println("Target family: ESP32-C6");
#else
  Serial.println("Target family: unknown to diagnostic sketch");
#endif

  Serial.print("Passive ADC scan enabled: ");
  Serial.println(SNOOPSMOKE_DIAG_ENABLE_PIN_SCAN ? "YES" : "NO");

#if SNOOPSMOKE_DIAG_DHT_PIN >= 0
  Serial.print("Configured DHT pin: GPIO");
  Serial.println(SNOOPSMOKE_DIAG_DHT_PIN);
#else
  Serial.println("Configured DHT pin: none");
#endif
}

void scanWiFi() {
  Serial.println();
  Serial.println("Scanning for nearby Wi-Fi networks...");
  Serial.println("This does not connect and does not require credentials.");

  WiFi.mode(WIFI_STA);
  const int networkCount = WiFi.scanNetworks(false, true);

  if (networkCount < 0) {
    Serial.println("Wi-Fi scan failed.");
    return;
  }

  Serial.print("Networks found: ");
  Serial.println(networkCount);

  for (int index = 0; index < networkCount; index++) {
    Serial.print(index + 1);
    Serial.print(" | SSID: ");
    Serial.print(WiFi.SSID(index));
    Serial.print(" | RSSI: ");
    Serial.print(WiFi.RSSI(index));
    Serial.print(" dBm | channel: ");
    Serial.print(WiFi.channel(index));
    Serial.print(" | encryption: ");
    Serial.println(WiFi.encryptionType(index));
  }

  WiFi.scanDelete();
}

void printClassicEsp32AdcCandidates() {
#if CONFIG_IDF_TARGET_ESP32
  Serial.println();
  Serial.println("Classic ESP32 ADC1 candidates: GPIO32, GPIO33, GPIO34, GPIO35, GPIO36, GPIO39");
  Serial.println("GPIO34/35/36/39 are input-only.");
#else
  Serial.println();
  Serial.println("No automatic ADC candidate list for this board family.");
  Serial.println("Use the exact board datasheet before enabling a pin scan.");
#endif
}

void scanAnalogCandidates() {
#if SNOOPSMOKE_DIAG_ENABLE_PIN_SCAN && CONFIG_IDF_TARGET_ESP32
  const uint8_t adcPins[] = {32, 33, 34, 35, 36, 39};
  Serial.println();
  Serial.println("Passive ADC1 scan; values are raw 12-bit readings.");
  Serial.println("This scan does not prove a sensor is attached or that the voltage is safe.");

  analogReadResolution(12);
  for (const uint8_t pin : adcPins) {
    pinMode(pin, INPUT);
    Serial.print("GPIO");
    Serial.print(pin);
    Serial.print(" = ");
    Serial.println(analogRead(pin));
  }
#else
  Serial.println();
  Serial.println("ADC scan is disabled.");
  Serial.println("Enable it only after the engineer verifies candidate GPIO voltage safety.");
#endif
}

void readConfiguredDht() {
#if SNOOPSMOKE_DIAG_DHT_PIN >= 0
  diagnosticDht.begin();
  const float temperature = diagnosticDht.readTemperature();
  const float humidity = diagnosticDht.readHumidity();

  Serial.println();
  Serial.print("DHT GPIO");
  Serial.println(SNOOPSMOKE_DIAG_DHT_PIN);

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT read failed.");
    return;
  }

  Serial.print("Temperature: ");
  Serial.print(temperature, 1);
  Serial.println(" C");
  Serial.print("Humidity: ");
  Serial.print(humidity, 1);
  Serial.println(" %");
#else
  Serial.println();
  Serial.println("DHT test is disabled because no verified DHT data pin is configured.");
#endif
}

void printHelp() {
  Serial.println();
  Serial.println("Commands:");
  Serial.println("  i  print board identity and build target");
  Serial.println("  w  scan nearby Wi-Fi networks without connecting");
  Serial.println("  p  print ADC candidate pins");
  Serial.println("  a  run optional passive ADC scan");
  Serial.println("  d  read the optional configured DHT pin");
  Serial.println("  h  print this help");
  Serial.println();
  Serial.println("No GPIO is driven by this sketch.");
  Serial.println("Do not enable pin scanning until external voltage safety is verified.");
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("SnoopSmoke diagnostic firmware started.");
  printIdentity();
  printClassicEsp32AdcCandidates();
  printHelp();
}

void loop() {
  if (!Serial.available()) {
    delay(20);
    return;
  }

  const char command = static_cast<char>(Serial.read());
  switch (command) {
    case 'i':
      printIdentity();
      break;
    case 'w':
      scanWiFi();
      break;
    case 'p':
      printClassicEsp32AdcCandidates();
      break;
    case 'a':
      scanAnalogCandidates();
      break;
    case 'd':
      readConfiguredDht();
      break;
    case 'h':
    case '?':
      printHelp();
      break;
    case '\r':
    case '\n':
      break;
    default:
      Serial.println("Unknown command. Send h for help.");
      break;
  }
}
