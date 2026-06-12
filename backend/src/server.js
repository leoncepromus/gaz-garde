/**
 * GasSafer Backend Server
 *
 * Start:  npm run dev
 * Docs:   http://localhost:3000/api/docs
 */

const config = require('./config');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const {
  initFirebase,
  getCurrentGasLevel,
  getSensorData,
  getHistory,
  saveSensorReading,
  setRelayCommand,
  getIncidents,
  getActiveIncident,
  acknowledgeIncident,
} = require('./firebase');
const { handleUSSD } = require('./ussd');
const { startWatcher } = require('./alerts');
const { sendVoiceCall, sendSMS, sendSafeNotification } = require('./twilio');

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── OpenAPI / Swagger (CDN UI, no extra npm deps) ─────────────────────────
const docsDir = [path.join(__dirname, '../docs'), path.join(__dirname, '../../docs')]
  .find((dir) => fs.existsSync(path.join(dir, 'swagger.html')))
  ?? path.join(__dirname, '../docs');
const swaggerHtml = path.resolve(docsDir, 'swagger.html');
const openApiYaml = path.resolve(docsDir, 'openapi.yaml');

app.get('/api/docs', (_req, res) => {
  if (!fs.existsSync(swaggerHtml)) {
    return res.status(503).json({
      error: 'API docs not bundled on this server',
      openapi: '/api/openapi.yaml',
      health: '/health',
    });
  }
  res.sendFile(swaggerHtml);
});
app.get('/api/openapi.yaml', (req, res) => {
  if (!fs.existsSync(openApiYaml)) {
    return res.status(404).json({ error: 'openapi.yaml not found' });
  }

  let protocol = req.protocol;
  const host = req.get('host') || '';
  if (protocol === 'http' && /\.onrender\.com$/i.test(host)) {
    protocol = 'https';
  }
  const requestBase = `${protocol}://${host}`;

  let yaml = fs.readFileSync(openApiYaml, 'utf8');
  yaml = yaml
    .replace('https://YOUR_PUBLIC_URL', requestBase)
    .replace('http://YOUR_PUBLIC_URL', requestBase);

  res.type('text/yaml').send(yaml);
});

// ── Sensor API key (NodeMCU → backend) ────────────────────────────────────
function requireSensorKey(req, res, next) {
  if (!config.sensor.apiKey) return next();
  const key = req.headers['x-sensor-key'] || req.query.key;
  if (key !== config.sensor.apiKey) {
    return res.status(401).json({ error: 'Invalid or missing sensor API key' });
  }
  next();
}

// ── Health check ──────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    service: 'GasSafer Backend',
    status: 'running',
    version: '1.0.0',
    docs: `${config.server.publicUrl}/api/docs`,
    firebase: config.firebase.databaseURL,
    threshold: `${config.gas.threshold}`,
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── TwiML: voice call script ──────────────────────────────────────────────
app.get('/twiml/alert', (req, res) => {
  const ppm = req.query.ppm || 'unknown';
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-GB" loop="3">
    Emergency alert from Gas Safer monitoring system.
    Gas leak detected. Current level is ${ppm} parts per million.
    This exceeds the safe limit of ${config.gas.threshold} parts per million.
    Please evacuate the premises immediately and call emergency services.
    Do not switch any electrical appliances on or off.
  </Say>
  <Pause length="1"/>
  <Say voice="alice">This message will repeat.</Say>
</Response>`);
});

app.post('/twilio/status', (req, res) => {
  console.log('Twilio call status:', req.body.CallStatus, 'SID:', req.body.CallSid);
  res.sendStatus(200);
});

app.post('/ussd', handleUSSD);

// ── REST API ──────────────────────────────────────────────────────────────

/** Current gas reading */
app.get('/api/gas', async (_req, res) => {
  try {
    const ppm = await getCurrentGasLevel();
    res.json({
      ppm,
      status: ppm >= config.gas.threshold ? 'danger' : 'safe',
      threshold: config.gas.threshold,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Full sensor object (gas + relay states) */
app.get('/api/sensor', async (_req, res) => {
  try {
    const data = await getSensorData();
    if (!data) {
      return res.status(404).json({ error: 'No sensor data yet' });
    }
    res.json({ ...data, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Reading history */
app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const history = await getHistory(limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * NodeMCU ingestion endpoint.
 * Alternative to writing directly to Firebase from the device.
 */
app.post('/api/sensor', requireSensorKey, async (req, res) => {
  try {
    const ppm = req.body.ppm ?? req.body.gasLevel;
    if (ppm === undefined || ppm === null) {
      return res.status(400).json({ error: 'ppm or gasLevel is required' });
    }

    const saved = await saveSensorReading(req.body);
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Lamp relay → Firebase /gas/relay (fan is local on device) */
app.post('/api/relay', async (req, res) => {
  const { state } = req.body;
  if (!['on', 'off', 'auto'].includes(state)) {
    return res.status(400).json({ error: 'state must be on, off, or auto' });
  }
  try {
    await setRelayCommand(state);
    res.json({ success: true, state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Active incident (post-notification state) */
app.get('/api/incidents/active', async (_req, res) => {
  try {
    const incident = await getActiveIncident();
    res.json(incident ?? null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Incident history */
app.get('/api/incidents', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 30;
    const incidents = await getIncidents(limit);
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Acknowledge alert — stops escalation reminders */
app.post('/api/incidents/:id/ack', async (req, res) => {
  try {
    const { channel = 'app', by = 'mobile-user' } = req.body;
    const result = await acknowledgeIncident(req.params.id, { by, channel });
    if (!result) return res.status(404).json({ error: 'Incident not found' });
    res.json({ success: true, incident: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Manual test alert (dev only — production uses alerts.js watcher) */
app.post('/api/test-alert', async (req, res) => {
  const ppm = req.body.ppm || 512;
  console.log(`🧪 Test alert: ${ppm}`);
  const [call, sms] = await Promise.all([sendVoiceCall(ppm), sendSMS(ppm)]);
  res.json({ call, sms });
});

/** All-clear notification when gas returns to safe */
app.post('/api/safe-alert', async (req, res) => {
  const ppm = req.body.ppm ?? 0;
  console.log(`✅ Safe alert: ${ppm}`);
  const sms = await sendSafeNotification(ppm);
  res.json({ sms });
});

// ── Start ─────────────────────────────────────────────────────────────────
async function main() {
  try {
    initFirebase();
    startWatcher();

    const server = app.listen(config.port, () => {
      console.log('\n🚀 GasSafer backend running');
      console.log(`   Local:  http://localhost:${config.port}`);
      console.log(`   Docs:   http://localhost:${config.port}/api/docs`);
      console.log(`   Public: ${config.server.publicUrl}`);
      console.log(`   Sensor: POST ${config.server.publicUrl}/api/sensor`);
      console.log(`   USSD:   POST ${config.server.publicUrl}/ussd`);
      console.log('');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Server startup failed: port ${config.port} is already in use.`);
        console.error('   Stop the running process using this port or set PORT to a different value in .env');
      } else {
        console.error('❌ Server startup failed:', err.message);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
}

main();
