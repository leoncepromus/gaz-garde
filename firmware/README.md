# NodeMCU Firmware (ESP8266)

GasSafer hardware firmware for NodeMCU + MQ-2 gas sensor.

## v2.1 Firebase paths

| Path | Direction | Content |
|------|-----------|---------|
| `/gas/sensor` | Device → cloud | `{ ppm, status, threshold, lastUpdated }` |
| `/gas/relay` | App → device | `{ state: "on" \| "off" }` lamp only |
| `/gas/history` | Backend/app | reading log |

Fan is **never** controlled from `/gas/relay` — only the gas sensor on the device.

## Setup

1. Install [Arduino IDE](https://www.arduino.cc/en/software) with ESP8266 board support
2. Install libraries: **LiquidCrystal I2C**, **ESP8266WiFi**, **ESP8266HTTPClient**, **ArduinoJson**
3. Copy config template:

```bash
cp config.example.h config.h
```

4. Edit `config.h` with your WiFi and Firebase (or backend) credentials
5. Select board: **NodeMCU 1.0 (ESP-12E Module)**
6. Upload `GasSafer.ino`

## Upload modes

| Mode | `USE_BACKEND_API` | Data destination |
|------|-------------------|------------------|
| Direct Firebase | `0` | Firebase Realtime DB `/sensor` |
| Via backend | `1` | `POST /api/sensor` on your server |

Direct Firebase is simpler for local dev. Backend mode is useful when you cannot expose Firebase write rules to the device.

## Pin map

See [DEPLOYMENT.md](../../docs/DEPLOYMENT.md#4-nodemcu-firmware).

## LCD display (matches app + backend)

The 16×2 I2C LCD shows the same fields as the mobile dashboard:

| LCD line | App equivalent |
|----------|----------------|
| `Gas: 350 DANGER` | Gas gauge + status banner |
| `Pwr:OFF Fan:ON ` | Electricity + Exhaust fan cards |

**Safe example:**
```
Gas:  16 SAFE
Pwr:ON  Fan:OFF
```

**Leak example:**
```
Gas: 512 DANGER
Pwr:OFF Fan:ON
```

**Manual mode** (from app Relay Control):
```
Gas:  16 MANUAL
Pwr:ON  Fan:OFF
```

### Threshold — keep in sync

Set `THRESHOLD` in `config.h` to the **same value** as `GAS_THRESHOLD` in the project `.env` (default **400**).

Logic on device, backend, and app:
- `gasLevel >= threshold` → status **danger** → cut power, start fan, buzzer
- `gasLevel < threshold` → status **safe** → restore power, fan runs 10s then stops

Calibrate: open Serial Monitor (115200), note normal `gasValue`, set threshold ~30% above that.

## Serial monitor

Baud rate: **115200**

You should see WiFi connect, then periodic `[Firebase] gas=...` or `[Backend] gas=...` lines every 3 seconds.
