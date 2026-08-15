#include <DHT.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <math.h>
#include <string.h>

// Copy SnoopSmoke_Config.h.example to SnoopSmoke_Config.h and fill in the
// local values. The real config file is ignored by Git.
#if defined(__has_include)
#if __has_include("SnoopSmoke_Config.h")
#include "SnoopSmoke_Config.h"
#endif
#endif

// =========================
// CONFIGURATION DEFAULTS
// =========================

#ifndef SNOOPSMOKE_WIFI_SSID
#define SNOOPSMOKE_WIFI_SSID ""
#endif

#ifndef SNOOPSMOKE_WIFI_PASSWORD
#define SNOOPSMOKE_WIFI_PASSWORD ""
#endif

#ifndef SNOOPSMOKE_DEVICE_ID
#define SNOOPSMOKE_DEVICE_ID "snoopsmoke-01"
#endif

// Any HTTPS-capable webhook or server endpoint that accepts the JSON payload
// documented in the README. Leave empty to run locally without cloud alerts.
#ifndef SNOOPSMOKE_ALERT_WEBHOOK_URL
#define SNOOPSMOKE_ALERT_WEBHOOK_URL ""
#endif

#ifndef SNOOPSMOKE_ALERT_API_KEY
#define SNOOPSMOKE_ALERT_API_KEY ""
#endif

// =========================
// UNIVERSAL ESP32 PIN MAP
// =========================

// These defaults target a classic ESP32 DevKit-style board. Override them in
// SnoopSmoke_Config.h if the board variant or verified wiring is different.
#ifndef SNOOPSMOKE_MQ2_PIN
#define SNOOPSMOKE_MQ2_PIN 34
#endif

#ifndef SNOOPSMOKE_DHT_PIN
#define SNOOPSMOKE_DHT_PIN 4
#endif

#ifndef SNOOPSMOKE_BUZZER_PIN
#define SNOOPSMOKE_BUZZER_PIN 25
#endif

#ifndef SNOOPSMOKE_ALERT_LED_PIN
#define SNOOPSMOKE_ALERT_LED_PIN 26
#endif

#ifndef SNOOPSMOKE_DHT_TYPE
#define SNOOPSMOKE_DHT_TYPE DHT11
#endif

const uint8_t MQ2_PIN = SNOOPSMOKE_MQ2_PIN;
const uint8_t DHT_PIN = SNOOPSMOKE_DHT_PIN;
const uint8_t BUZZER_PIN = SNOOPSMOKE_BUZZER_PIN;
const uint8_t ALERT_LED_PIN = SNOOPSMOKE_ALERT_LED_PIN;

DHT dht(DHT_PIN, SNOOPSMOKE_DHT_TYPE);

// =========================
// DETECTION SETTINGS
// =========================

// Initial test values only. Calibrate these with the installed sensor.
#ifndef SNOOPSMOKE_WARNING_THRESHOLD
#define SNOOPSMOKE_WARNING_THRESHOLD 500
#endif

#ifndef SNOOPSMOKE_DETECTION_THRESHOLD
#define SNOOPSMOKE_DETECTION_THRESHOLD 700
#endif

#ifndef SNOOPSMOKE_SAMPLE_INTERVAL_MS
#define SNOOPSMOKE_SAMPLE_INTERVAL_MS 2000UL
#endif

#ifndef SNOOPSMOKE_WIFI_RETRY_INTERVAL_MS
#define SNOOPSMOKE_WIFI_RETRY_INTERVAL_MS 30000UL
#endif

#ifndef SNOOPSMOKE_ALERT_RETRY_INTERVAL_MS
#define SNOOPSMOKE_ALERT_RETRY_INTERVAL_MS 10000UL
#endif

struct SensorReading {
  int smoke;
  float temperature;
  float humidity;
  bool dhtValid;
};

enum class SmokeState : uint8_t {
  Normal,
  Warning,
  Detected
};

SmokeState currentState = SmokeState::Normal;
bool stateInitialized = false;
bool pendingAlert = false;
SmokeState pendingState = SmokeState::Normal;
SensorReading pendingReading = {0, NAN, NAN, false};

unsigned long lastSampleAt = 0;
unsigned long lastWiFiAttemptAt = 0;
unsigned long lastAlertAttemptAt = 0;

bool hasWiFiConfig() {
  return strlen(SNOOPSMOKE_WIFI_SSID) > 0;
}

bool hasWebhookConfig() {
  return strlen(SNOOPSMOKE_ALERT_WEBHOOK_URL) > 0;
}

const char* stateLabel(SmokeState state) {
  switch (state) {
    case SmokeState::Detected:
      return "SMOKE DETECTED";
    case SmokeState::Warning:
      return "POSSIBLE SMOKE";
    default:
      return "NORMAL";
  }
}

const char* eventLabel(SmokeState state) {
  switch (state) {
    case SmokeState::Detected:
      return "SMOKE_DETECTED";
    case SmokeState::Warning:
      return "POSSIBLE_SMOKE";
    default:
      return "CLEAR";
  }
}

SmokeState classifySmoke(int smokeValue) {
  if (smokeValue >= SNOOPSMOKE_DETECTION_THRESHOLD) {
    return SmokeState::Detected;
  }

  if (smokeValue >= SNOOPSMOKE_WARNING_THRESHOLD) {
    return SmokeState::Warning;
  }

  return SmokeState::Normal;
}

void connectWiFi() {
  if (!hasWiFiConfig()) {
    return;
  }

  lastWiFiAttemptAt = millis();
  Serial.print("Connecting to Wi-Fi");

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(SNOOPSMOKE_WIFI_SSID, SNOOPSMOKE_WIFI_PASSWORD);

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 15000UL) {
    delay(250);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Wi-Fi connected: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("Wi-Fi unavailable; local monitoring continues.");
  }
}

void maintainWiFi() {
  if (!hasWiFiConfig() || WiFi.status() == WL_CONNECTED) {
    return;
  }

  if (millis() - lastWiFiAttemptAt >= SNOOPSMOKE_WIFI_RETRY_INTERVAL_MS) {
    connectWiFi();
  }
}

String jsonNumber(float value, bool valid) {
  if (!valid || isnan(value)) {
    return "null";
  }

  return String(value, 1);
}

bool postAlert(const char* event, SmokeState state, const SensorReading& reading) {
  if (!hasWebhookConfig() || WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  if (!http.begin(SNOOPSMOKE_ALERT_WEBHOOK_URL)) {
    Serial.println("Unable to open alert webhook.");
    return false;
  }

  http.setConnectTimeout(5000);
  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");

  if (strlen(SNOOPSMOKE_ALERT_API_KEY) > 0) {
    http.addHeader("X-API-Key", SNOOPSMOKE_ALERT_API_KEY);
  }

  String payload = "{\"device\":\"";
  payload += SNOOPSMOKE_DEVICE_ID;
  payload += "\",\"event\":\"";
  payload += event;
  payload += "\",\"status\":\"";
  payload += stateLabel(state);
  payload += "\",\"smoke\":";
  payload += String(reading.smoke);
  payload += ",\"temperature\":";
  payload += jsonNumber(reading.temperature, reading.dhtValid);
  payload += ",\"humidity\":";
  payload += jsonNumber(reading.humidity, reading.dhtValid);
  payload += ",\"wifi_rssi\":";
  payload += String(WiFi.RSSI());
  payload += "}";

  const int responseCode = http.POST(payload);
  Serial.print("Alert webhook response: ");
  Serial.println(responseCode);
  http.end();

  return responseCode >= 200 && responseCode < 300;
}

void queueStateAlert(SmokeState nextState, const SensorReading& reading) {
  if (stateInitialized && nextState == currentState) {
    return;
  }

  const SmokeState previousState = currentState;
  currentState = nextState;
  stateInitialized = true;

  // Do not notify for the first normal reading. Notify on warning, detection,
  // and the return to normal after an alert.
  const bool shouldNotify = nextState != SmokeState::Normal || previousState != SmokeState::Normal;
  if (!shouldNotify) {
    return;
  }

  pendingState = nextState;
  pendingReading = reading;
  pendingAlert = true;
}

void trySendPendingAlert() {
  if (!pendingAlert) {
    return;
  }

  if (!hasWebhookConfig()) {
    pendingAlert = false;
    return;
  }

  if (millis() - lastAlertAttemptAt < SNOOPSMOKE_ALERT_RETRY_INTERVAL_MS) {
    return;
  }

  lastAlertAttemptAt = millis();
  if (postAlert(eventLabel(pendingState), pendingState, pendingReading)) {
    pendingAlert = false;
  }
}

void updateLocalIndicators(SmokeState state) {
  digitalWrite(ALERT_LED_PIN, state == SmokeState::Normal ? LOW : HIGH);

  // The default assumes an active buzzer module. Use a transistor driver for
  // buzzers that draw more current than an ESP32 GPIO can safely supply.
  digitalWrite(BUZZER_PIN, state == SmokeState::Detected ? HIGH : LOW);
}

SensorReading readSensors() {
  SensorReading reading;
  reading.smoke = analogRead(MQ2_PIN);
  reading.temperature = dht.readTemperature();
  reading.humidity = dht.readHumidity();
  reading.dhtValid = !isnan(reading.temperature) && !isnan(reading.humidity);
  return reading;
}

void printReading(const SensorReading& reading, SmokeState state) {
  Serial.println("--------------------------------");
  Serial.print("Smoke/Gas Level: ");
  Serial.println(reading.smoke);

  if (reading.dhtValid) {
    Serial.print("Temperature: ");
    Serial.print(reading.temperature, 1);
    Serial.println(" C");

    Serial.print("Humidity: ");
    Serial.print(reading.humidity, 1);
    Serial.println(" %");
  } else {
    Serial.println("DHT11: READ FAILED");
  }

  Serial.print("Status: ");
  Serial.println(stateLabel(state));
}

void setup() {
  Serial.begin(115200);

  pinMode(ALERT_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(ALERT_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  pinMode(MQ2_PIN, INPUT);
  analogReadResolution(12);

  dht.begin();

  Serial.println();
  Serial.println("================================");
  Serial.println("       SNOOPSMOKE SYSTEM");
  Serial.println("================================");
  Serial.println("Local monitoring starting...");

  if (hasWebhookConfig()) {
    Serial.println("Cloud alert transport: configured");
  } else {
    Serial.println("Cloud alert transport: not configured");
  }

  connectWiFi();
}

void loop() {
  maintainWiFi();
  trySendPendingAlert();

  if (millis() - lastSampleAt < SNOOPSMOKE_SAMPLE_INTERVAL_MS) {
    delay(10);
    return;
  }

  lastSampleAt = millis();
  const SensorReading reading = readSensors();
  const SmokeState state = classifySmoke(reading.smoke);

  updateLocalIndicators(state);
  printReading(reading, state);
  queueStateAlert(state, reading);
  trySendPendingAlert();
}
