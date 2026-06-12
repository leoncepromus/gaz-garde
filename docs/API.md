# GasSafer API Reference

Interactive docs: **http://localhost:3000/api/docs** (Swagger UI)

OpenAPI spec: [openapi.yaml](./openapi.yaml)

## Quick reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info + doc link |
| GET | `/health` | Health check |
| GET | `/api/gas` | Current gas level |
| GET | `/api/sensor` | Full sensor state (gas + relays) |
| POST | `/api/sensor` | Ingest reading from NodeMCU |
| GET | `/api/history?limit=20` | Reading history |
| POST | `/api/test-alert` | Trigger voice call + SMS |
| POST | `/api/safe-alert` | Send all-clear SMS |
| GET | `/twiml/alert?ppm=512` | Twilio voice script |
| POST | `/twilio/status` | Twilio webhook |
| POST | `/ussd` | Africa's Talking USSD |

## NodeMCU integration

### Option A — Direct Firebase (default)

Device writes to:

- `PUT /sensor/gasLevel.json?auth=SECRET`
- `PATCH /sensor.json?auth=SECRET`

See `firmware/GasSafer/GasSafer.ino`.

### Option B — Via backend

```http
POST /api/sensor
Content-Type: application/json
X-Sensor-Key: your_sensor_api_key

{
  "gasLevel": 350,
  "status": "safe",
  "threshold": 680,
  "electricity": "on",
  "fan": "off",
  "rssi": -62
}
```

## Mobile app integration

The app uses Firebase for live data and the backend for alerts:

```typescript
// services/api.ts
await api.triggerTestAlert(ppm);
await api.triggerSafeAlert(ppm);
await api.checkHealth();
```

Set `EXPO_PUBLIC_API_URL` in `.env`.

## Firebase data model

```
/sensor
  gasLevel: number
  status: "safe" | "danger"
  threshold: number
  electricity: "on" | "off"
  fan: "on" | "off"
  rssi: number

/history
  {pushId}
    ppm: number
    status: "safe" | "danger"
    timestamp: ISO string
```
