#ifndef GASSAFER_CONFIG_H
#define GASSAFER_CONFIG_H

// ── WiFi ──────────────────────────────────────────────────────────
#define WIFI_SSID     "ZTE_2.4G_E5dF64"
#define WIFI_PASSWORD "E3GfsDav"

// ── Firebase Realtime Database ────────────────────────────────────
#define FIREBASE_HOST "gasleakmonitor-ae209-default-rtdb.europe-west1.firebasedatabase.app"
#define FIREBASE_SECRET "TLHkIVw1KYLLFtwXQSlP3LI4FqZ9AWhj7YlXa6OU"

// ── Sensor (raw MQ-2 ADC 0–1023) ──────────────────────────────────
// Calibrate via Serial Monitor; typical safe readings 50–400
#define THRESHOLD       680

#define SEND_INTERVAL   3000    // ms — Firebase write interval
#define RELAY_INTERVAL  5000    // ms — check /gas/relay for lamp command
#define WARMUP_MS       30000   // ms — MQ-2 preheat before monitoring

#define BUZZER_BEEP_MS  300
#define LCD_I2C_ADDR    0x27    // try 0x3F if blank screen

#endif
