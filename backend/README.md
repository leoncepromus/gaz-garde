# GasSafer Backend

Express API bridging Firebase, Twilio voice/SMS, and Africa's Talking USSD.

## Quick start

```bash
cd backend
npm install
npm run dev
```

Requires `.env` in the **project root** (see `../.env.example`).

## API documentation

| Resource | URL |
|----------|-----|
| Swagger UI | http://localhost:3000/api/docs |
| OpenAPI YAML | http://localhost:3000/api/openapi.yaml |
| Human-readable | [../docs/API.md](../docs/API.md) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm start` | Production start |
| `npm run simulate` | Fake NodeMCU readings to Firebase |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/docs` | Swagger UI |
| GET | `/api/gas` | Current gas level |
| GET | `/api/sensor` | Full sensor + relay state |
| POST | `/api/sensor` | Ingest from NodeMCU (optional) |
| GET | `/api/history` | Reading history |
| POST | `/api/test-alert` | Test voice + SMS |
| POST | `/api/safe-alert` | All-clear SMS |
| POST | `/ussd` | Africa's Talking callback |

Full deploy guide: [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)
