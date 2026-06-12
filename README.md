# GasSafer — IoT Gas Leak Monitoring System

**University of Rwanda · Information Technology · Final Year Project 2025–2026**  
Team: Kamana Fabien · HABONIMANA Fidele · TWAYINGANYIKI Promis Leonce

Monorepo with three parts: **Expo mobile app**, **Node.js backend**, and **NodeMCU firmware**.

## Project structure

```
gasSafer-main/
├── app/                  # Expo React Native screens (mobile frontend)
├── components/           # Shared UI components
├── services/
│   ├── firebase.ts       # Live sensor data from Firebase
│   └── api.ts            # Backend REST client (alerts, health)
├── backend/              # Express API — Twilio, USSD, Firebase watcher
│   └── src/
├── firmware/             # NodeMCU ESP8266 Arduino sketch
│   └── GasSafer/
├── docs/
│   ├── API.md            # API reference
│   ├── DEPLOYMENT.md     # Full deploy guide (NodeMCU + cloud)
│   └── openapi.yaml      # OpenAPI 3 spec (Swagger)
├── .env.example          # All environment variables
└── package.json          # Root scripts (mobile + backend)
```

## System flow

```
NodeMCU (MQ-2) ──▶ Firebase /sensor ──▶ Mobile app (live dashboard)
                         │
                         └──▶ Backend watcher ──▶ Twilio + USSD alerts
```

## Quick start

### 1. Configure environment

```bash
cp .env.example .env
# Fill Firebase, Twilio, and API URL values
```

Place `serviceAccountKey.json` in the project root (Firebase console → Service accounts).

### 2. Install everything

```bash
npm run install:all
```

### 3. Start backend

```bash
npm run backend
```

- Health: http://localhost:3000/health  
- **API docs (Swagger):** http://localhost:3000/api/docs

### 4. Start mobile app

```bash
npm run mobile
```
j
Scan the QR code with Expo Go.

### 5. Flash NodeMCU

```bash
cp firmware/GasSafer/config.example.h firmware/GasSafer/config.h
# Edit config.h → open firmware/GasSafer/GasSafer.ino in Arduino IDE → upload
```

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for wiring, ngrok, and cloud deploy.

## Test without hardware

```bash
npm run backend:simulate
```

Or trigger a manual alert:

```bash
curl -X POST http://localhost:3000/api/test-alert \
  -H "Content-Type: application/json" \
  -d '{"ppm": 512}'
```

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/API.md](./docs/API.md) | Endpoint reference |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | NodeMCU, backend, mobile deploy |
| [docs/openapi.yaml](./docs/openapi.yaml) | OpenAPI spec |
| [backend/README.md](./backend/README.md) | Backend-only quick start |
| [firmware/README.md](./firmware/README.md) | Arduino / NodeMCU setup |

## Integration summary

| Component | Connects to | Purpose |
|-----------|-------------|---------|
| NodeMCU | Firebase direct **or** `POST /api/sensor` | Push gas readings every 3s |
| Mobile app | Firebase + `EXPO_PUBLIC_API_URL` | Live UI + trigger alerts |
| Backend | Firebase Admin + Twilio + AT | Watch threshold, call/SMS/USSD |

## Expose backend publicly

Twilio and USSD need HTTPS:

```bash
ngrok http 3000
```

Set `SERVER_PUBLIC_URL` and `EXPO_PUBLIC_API_URL` to the ngrok URL, then restart backend and Expo.
