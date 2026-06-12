# GasSafer Deployment Guide

End-to-end setup for NodeMCU, backend, and Expo mobile app.

## Architecture

```
┌─────────────────┐     HTTPS (3s)      ┌──────────────────────────┐
│  NodeMCU ESP8266│ ──────────────────▶ │ Firebase Realtime DB     │
│  MQ-2 + relays  │   /sensor           │  sensor/gasLevel         │
└─────────────────┘                     │  history                 │
        │                               └───────────┬──────────────┘
        │ optional POST /api/sensor               │
        ▼                                           │ onValue
┌─────────────────┐                                 │
│  Backend API    │◀────────────────────────────────┘
│  Express + Node │     Firebase Admin watcher
└────────┬────────┘
         ├── Twilio → voice + SMS
         ├── Africa's Talking → USSD *801*1560#
         └── Swagger docs at /api/docs

┌─────────────────┐
│  Expo Mobile App│ ── Firebase (live dashboard)
│  React Native   │ ── Backend (trigger alerts)
└─────────────────┘
```

## 1. Firebase

1. Create project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Realtime Database** (choose region, e.g. `europe-west1`)
3. Set rules (dev — tighten for production):

```json
{
  "rules": {
    "sensor": { ".read": true, ".write": true },
    "history": { ".read": true, ".write": true }
  }
}
```

4. **Backend**: Project settings → Service accounts → Generate private key → save as `serviceAccountKey.json` in project root
5. **Mobile**: Project settings → Web app → copy SDK config into `.env` (`EXPO_PUBLIC_FIREBASE_*`)
6. **NodeMCU**: Project settings → Service accounts → Database secrets (legacy) OR use backend `POST /api/sensor` with API key

## 2. Environment file

Copy `.env.example` to `.env` in the project root and fill all values.

```bash
cp .env.example .env
```

## 3. Backend

```bash
cd backend
npm install
npm run dev
```

- API docs: http://localhost:3000/api/docs
- Health: http://localhost:3000/health

### Expose publicly (Twilio + USSD webhooks)

Twilio and Africa's Talking need a public HTTPS URL:

```bash
ngrok http 3000
```

Set `SERVER_PUBLIC_URL=https://YOUR_NGROK_URL` in `.env` and restart the backend.

**USSD:** Register callback `https://YOUR_NGROK_URL/ussd` in Africa's Talking dashboard.  
Full step-by-step: [docs/USSD.md](./USSD.md)

### Deploy to cloud (alternatives to ngrok)

| Platform | Notes |
|----------|-------|
| [Railway](https://railway.app) | Set env vars, deploy from `backend/` |
| [Render](https://render.com) | Web service, start command `npm start` |
| VPS (Ubuntu) | `pm2 start src/server.js`, nginx reverse proxy + SSL |

Set `FIREBASE_SERVICE_ACCOUNT_JSON` as a single-line JSON string when deploying (no file upload needed).

## 4. NodeMCU firmware

```bash
# 1. Copy config template
cp firmware/GasSafer/config.example.h firmware/GasSafer/config.h

# 2. Edit config.h — WiFi, Firebase host, database secret
# 3. Open firmware/GasSafer/GasSafer.ino in Arduino IDE
# 4. Board: NodeMCU 1.0 (ESP-12E), upload
```

### Wiring (unchanged)

| Pin | Function |
|-----|----------|
| A0 | MQ-2 analog |
| D3 (GPIO0) | Blue LED — safe |
| D4 (GPIO2) | Red LED — danger |
| D5 (GPIO14) | Buzzer |
| D6 (GPIO12) | Relay — electricity cutoff |
| D7 (GPIO13) | Relay — exhaust fan |
| D1/D2 | LCD I2C SDA/SCL |

### Alternative: post via backend instead of Firebase

In `config.h`, set `USE_BACKEND_API true` and `BACKEND_URL` to your public server.
The firmware will `POST /api/sensor` with header `X-Sensor-Key`.

## 5. Mobile app (Expo)

```bash
# From project root
npm install --legacy-peer-deps
npx expo start
```

Set in `.env`:

```
EXPO_PUBLIC_API_URL=https://YOUR_BACKEND_URL
EXPO_PUBLIC_FIREBASE_...=...
```

Build for production:

```bash
npx eas build --platform android
```

## 6. Test without hardware

```bash
cd backend
npm run simulate
```

Or trigger a manual alert:

```bash
curl -X POST http://localhost:3000/api/test-alert \
  -H "Content-Type: application/json" \
  -d '{"ppm": 512}'
```

## Threshold note

- **NodeMCU** uses raw MQ-2 ADC values (default threshold **680** in firmware)
- **Backend / mobile** use `GAS_THRESHOLD` in `.env` (default **400**)

Calibrate both to match your sensor. The mobile app displays whatever value Firebase receives.
