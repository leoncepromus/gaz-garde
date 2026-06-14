# GasSafer USSD Setup Guide

Users dial your USSD code (`*801*1560#`) to check gas status or acknowledge an active leak **without a smartphone app or mobile data on the phone** — the session runs over the GSM network.

Your backend already implements the menu in `backend/src/ussd.js` at **`POST /ussd`**.

---

## Architecture

```
Phone (*384*X#)  →  Africa's Talking gateway  →  POST https://YOUR-SERVER/ussd
                                                          │
                                                          ▼
                                                   Firebase (gas level, incidents)
```

Africa's Talking sends **form-urlencoded** POST body fields:

| Field | Example | Used by GasSafer |
|-------|---------|------------------|
| `sessionId` | `ATUid_xxx` | (logged by AT) |
| `serviceCode` | `*801*1560#` | — |
| `phoneNumber` | `+2507XXXXXXXX` | Acknowledgment audit |
| `text` | ``, `1`, `5` | Menu navigation |

Response must be **plain text** starting with `CON` (continue menu) or `END` (close session).

---

## Prerequisites

- [ ] Backend running (`npm run backend`)
- [ ] Firebase connected (sensor data in `/gas/sensor`)
- [ ] **Public HTTPS URL** (ngrok for dev, Render/Railway for production)
- [ ] [Africa's Talking](https://africastalking.com) account (sandbox is free)

---

## Step 1 — Start backend

```bash
cd gasSafer-main
npm run backend
```

Confirm locally:

```bash
curl -X POST http://localhost:3000/ussd \
  -d "phoneNumber=+250796233029&text="
```

Expected:

```
CON GasSafer Monitor
1. Current gas level
...
```

---

## Step 2 — Expose backend publicly (HTTPS)

Africa's Talking **cannot** call `localhost`. You need a public URL.

### Option A — ngrok (development)

```bash
ngrok http 3000
```

Copy the **https** URL (e.g. `https://abc123.ngrok-free.dev`).

Update `.env`:

```env
SERVER_PUBLIC_URL=https://abc123.ngrok-free.dev
EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.dev
```

Restart the backend, then test:

```bash
curl -X POST https://abc123.ngrok-free.dev/ussd \
  -d "phoneNumber=+250796233029&text=1"
```

> **Note:** Free ngrok URLs change every restart. Update Africa's Talking callback each time, or use a paid ngrok reserved domain.

### Option B — Render / Railway (production)

Deploy the `backend/` folder as a web service. Set all env vars from `.env.example`.

Callback URL becomes:

```
https://gaz-garde.onrender.com/ussd
```

Set `SERVER_PUBLIC_URL` to the same base URL.

For the Render service in this repo, the default callback is:

```text
https://gaz-garde.onrender.com/ussd
```

---

## Step 3 — Africa's Talking account

1. Sign up at [https://account.africastalking.com](https://account.africastalking.com)
2. Open the **Sandbox** app (for testing)
3. Note your **username** (often `sandbox`) and **API key** (Settings → API Key)

Add to `.env` (optional for the handler, useful for dashboard/API later):

```env
AT_USERNAME=sandbox
AT_API_KEY=your_sandbox_api_key_here
```

---

## Step 4 — Create USSD channel (sandbox)

1. In Africa's Talking dashboard → **USSD** → **Create Channel** (or **Service Codes**)
2. Fill in:
   - **Channel name:** GasSafer
  - **Callback URL:** `https://gaz-garde.onrender.com/ussd`
3. Save — you receive the assigned Africa's Talking code, for example `*801*1560#`.

### Update the app constant

Edit `constants/index.ts`:

```ts
export const USSD_CODE = '*801*1560#';  // your assigned code from AT dashboard
```

Rebuild/restart Expo so Settings and Emergency screens show the correct code.

---

## Step 5 — Test in sandbox simulator

1. Africa's Talking dashboard → **USSD** → **Simulator** (or dial from sandbox test phone)
2. Enter your service code
3. Walk through menu options 1–4
4. During an **active unacked leak**, option **5** should appear — use it to acknowledge

---

## Step 6 — Menu reference

| Input | Action |
|-------|--------|
| (dial code) | Main menu (`CON`) |
| `1` | Current gas level + safe/danger |
| `2` | Last 3 readings from Firebase history |
| `3` | Sensor online + incident status |
| `4` | Emergency contacts (primary Twilio number, 112, 113) |
| `5` | Acknowledge active alert (stops voice/SMS escalation) |

---

## Step 7 — Go live in Rwanda (production)

Sandbox codes only work in the AT simulator / test numbers. For real users on MTN/Airtel:

1. Apply for a **production USSD code** via Africa's Talking (shared or dedicated)
2. Switch dashboard from **Sandbox** to **Production** app
3. Set production callback URL on the assigned service code
4. Update `USSD_CODE` in the app to the live code
5. Complete telco/regulator requirements (fees and approval apply — see [africastalking.com/ussd](https://africastalking.com/ussd))

If the resource notice shows `*801*1560#`, use that as the live code under **USSD → Service Codes → Callback** in Africa's Talking.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `404` on callback URL | ngrok expired or wrong URL — restart ngrok, update `.env` and AT dashboard |
| `Service temporarily unavailable` | Firebase error — check `FIREBASE_*` vars and backend logs |
| Menu shows but ppm is wrong | Align `GAS_THRESHOLD` in `.env` with sensor/firmware |
| Option 5 missing | No **active unacknowledged** incident in Firebase |
| Dialing the code does nothing | Confirm the callback URL is public HTTPS and the code matches the one assigned by Africa's Talking |
| Ack works but escalation continues | Restart backend watcher; confirm incident `acknowledged: true` in Firebase |

---

## Quick test script (PowerShell)

```powershell
$base = "http://localhost:3000"
Invoke-WebRequest "$base/ussd" -Method POST -Body @{ phoneNumber="+250796233029"; text="" }
Invoke-WebRequest "$base/ussd" -Method POST -Body @{ phoneNumber="+250796233029"; text="1" }
Invoke-WebRequest "$base/ussd" -Method POST -Body @{ phoneNumber="+250796233029"; text="3" }
```

---

## Related files

| File | Role |
|------|------|
| `backend/src/ussd.js` | Menu logic |
| `backend/src/server.js` | Route `POST /ussd` |
| `constants/index.ts` | `USSD_CODE` shown in app |
| `app/(drawer)/emergency.tsx` | Dial helper + menu docs |
| `.env` | `SERVER_PUBLIC_URL`, optional `AT_*` |
