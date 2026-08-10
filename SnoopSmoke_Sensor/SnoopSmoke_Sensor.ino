#include <DHT.h>

// =========================
// SNOOPSMOKE PIN SETTINGS
// =========================

// MQ-2 analog output
const int MQ2_PIN = 34;

// DHT11
const int DHT_PIN = 4;
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

// =========================
// DETECTION SETTINGS
// =========================

// These are INITIAL TEST VALUES.
// They MUST be calibrated using the actual MQ-2.
const int WARNING_THRESHOLD = 500;
const int DETECTION_THRESHOLD = 700;

// =========================
// SETUP
// =========================

void setup() {
  Serial.begin(115200);

  dht.begin();

  Serial.println();
  Serial.println("================================");
  Serial.println("       SNOOPSMOKE SYSTEM");
  Serial.println("================================");
  Serial.println("System starting...");
}

// =========================
// MAIN LOOP
// =========================

void loop() {

  // Read MQ-2
  int smokeValue = analogRead(MQ2_PIN);

  // Read DHT11
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  // Determine detection status
  String status;

  if (smokeValue >= DETECTION_THRESHOLD) {
    status = "SMOKE DETECTED";
  }
  else if (smokeValue >= WARNING_THRESHOLD) {
    status = "POSSIBLE SMOKE";
  }
  else {
    status = "NORMAL";
  }

  // Display readings
  Serial.println("--------------------------------");

  Serial.print("Smoke/Gas Level: ");
  Serial.println(smokeValue);

  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" C");

  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");

  Serial.print("Status: ");
  Serial.println(status);

  delay(2000);
}
