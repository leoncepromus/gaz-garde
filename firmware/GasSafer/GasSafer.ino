// GasSafer — NodeMCU ESP8266 Gas Leak Monitor v2.1
//
// Firebase:
//   WRITE  /gas/sensor  ← readings { ppm, status, threshold, lastUpdated }
//   READ   /gas/relay   ← lamp commands { state: "on"|"off" } (fan is LOCAL only)
//
// See config.h for WiFi, Firebase secret, threshold.

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>
#include "config.h"

#define MQ2_PIN      A0
#define LED_BLUE      0
#define LED_RED       2
#define BUZZER       14
#define RELAY_LAMP   12
#define RELAY_FAN    13

#define RELAY_ON   LOW
#define RELAY_OFF  HIGH

LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);

unsigned long lastSend       = 0;
unsigned long lastRelayCheck = 0;
unsigned long bootTime       = 0;
bool          wasLeaking     = false;
bool          warmedUp       = false;

String buildUrl(const char* path) {
  return "https://" + String(FIREBASE_HOST) +
         String(path) + ".json?auth=" + String(FIREBASE_SECRET);
}

String uptimeISO() {
  char buf[24];
  snprintf(buf, sizeof(buf), "boot+%lus", millis() / 1000);
  return String(buf);
}

void connectWiFi() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  Serial.print("Connecting WiFi");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println(WiFi.localIP());
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(1500);
  } else {
    Serial.println("\nWiFi FAILED");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi FAILED");
    lcd.setCursor(0, 1);
    lcd.print("Offline mode");
    delay(2000);
  }
}

void sendToFirebase(int rawValue, bool leaking) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String status  = leaking ? "danger" : "safe";
  String payload = "{\"ppm\":" + String(rawValue) +
                   ",\"status\":\"" + status + "\"" +
                   ",\"threshold\":" + String(THRESHOLD) +
                   ",\"lastUpdated\":\"" + uptimeISO() + "\"}";

  http.begin(client, buildUrl("/gas/sensor"));
  http.addHeader("Content-Type", "application/json");
  int code = http.PUT(payload);
  http.end();

  Serial.printf("[Firebase] ppm=%d %s HTTP=%d\n", rawValue, status.c_str(), code);
}

void checkRelayCommand() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  http.begin(client, buildUrl("/gas/relay"));
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<128> doc;
    if (!deserializeJson(doc, body) && doc["state"]) {
      const char* state = doc["state"];
      if (strcmp(state, "on") == 0) {
        digitalWrite(RELAY_LAMP, RELAY_ON);
        Serial.println("[Relay] Backend: LAMP ON");
      } else if (strcmp(state, "off") == 0 && !wasLeaking) {
        digitalWrite(RELAY_LAMP, RELAY_OFF);
        Serial.println("[Relay] Backend: LAMP OFF");
      }
    }
  }
  http.end();
}

void lcdShowReading(int rawValue, bool leaking) {
  lcd.setCursor(0, 0);
  lcd.print("Gas Level: ");
  lcd.print(rawValue);
  lcd.print("    ");

  lcd.setCursor(0, 1);
  lcd.print(leaking ? "!! GAS LEAK !!  " : "Status: Safe    ");
}

void lcdShowWarmup(unsigned long remaining) {
  lcd.setCursor(0, 0);
  lcd.print("Sensor warmup   ");
  lcd.setCursor(0, 1);
  lcd.print("Wait: ");
  lcd.print(remaining / 1000);
  lcd.print("s      ");
}

void setup() {
  Serial.begin(115200);
  delay(100);

  Wire.begin(5, 4);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("GasSafer v2.1   ");
  lcd.setCursor(0, 1);
  lcd.print("Initialising... ");
  delay(1000);

  pinMode(LED_BLUE,   OUTPUT);
  pinMode(LED_RED,    OUTPUT);
  pinMode(BUZZER,     OUTPUT);
  pinMode(RELAY_LAMP, OUTPUT);
  pinMode(RELAY_FAN,  OUTPUT);

  digitalWrite(RELAY_LAMP, RELAY_OFF);
  digitalWrite(RELAY_FAN,  RELAY_OFF);
  digitalWrite(LED_RED,    LOW);
  digitalWrite(LED_BLUE,   HIGH);
  digitalWrite(BUZZER,     LOW);

  connectWiFi();
  bootTime = millis();
}

void loop() {
  unsigned long now = millis();

  if (!warmedUp) {
    unsigned long elapsed = now - bootTime;
    if (elapsed < WARMUP_MS) {
      lcdShowWarmup(WARMUP_MS - elapsed);
      delay(500);
      return;
    }
    warmedUp = true;
    lcd.clear();
    Serial.println("Sensor ready");
  }

  if (WiFi.status() != WL_CONNECTED) {
    lcd.setCursor(0, 1);
    lcd.print("WiFi reconnect..");
    WiFi.reconnect();
    delay(3000);
    return;
  }

  int  rawValue = analogRead(MQ2_PIN);
  bool leaking  = rawValue > THRESHOLD;

  lcdShowReading(rawValue, leaking);

  if (leaking) {
    digitalWrite(RELAY_LAMP, RELAY_ON);
    digitalWrite(RELAY_FAN,  RELAY_ON);
    digitalWrite(LED_RED,    HIGH);
    digitalWrite(LED_BLUE,   LOW);
    digitalWrite(BUZZER,     HIGH);
    if (!wasLeaking) {
      Serial.printf("LEAK raw=%d threshold=%d\n", rawValue, THRESHOLD);
      wasLeaking = true;
    }
  } else {
    digitalWrite(RELAY_LAMP, RELAY_OFF);
    digitalWrite(RELAY_FAN,  RELAY_OFF);
    digitalWrite(LED_RED,    LOW);
    digitalWrite(LED_BLUE,   HIGH);
    digitalWrite(BUZZER,     LOW);
    if (wasLeaking) {
      Serial.printf("Cleared raw=%d\n", rawValue);
      wasLeaking = false;
    }
  }

  if (now - lastSend >= SEND_INTERVAL) {
    lastSend = now;
    sendToFirebase(rawValue, leaking);
  }

  if (now - lastRelayCheck >= RELAY_INTERVAL) {
    lastRelayCheck = now;
    checkRelayCommand();
  }

  delay(200);
}
