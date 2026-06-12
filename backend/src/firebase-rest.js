/**
 * Firebase Realtime Database via REST API.
 */
const axios = require('axios');
const https = require('https');
const paths = require('./paths');
const { buildIncidentApi } = require('./incidents');

const baseUrl = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
const ignoreSsl = process.env.FIREBASE_IGNORE_SSL === 'true';

const httpsAgent = ignoreSsl
  ? new https.Agent({ rejectUnauthorized: false })
  : undefined;

const client = axios.create({
  baseURL: baseUrl,
  httpsAgent,
  timeout: 15000,
});

async function get(path) {
  const { data } = await client.get(`/${path}.json`);
  return data;
}

async function set(path, value) {
  const { data } = await client.put(`/${path}.json`, value);
  return data;
}

async function update(path, value) {
  const { data } = await client.patch(`/${path}.json`, value);
  return data;
}

async function push(path, value) {
  const { data } = await client.post(`/${path}.json`, value);
  return data;
}

function extractPpm(sensor) {
  if (!sensor) return 0;
  if (typeof sensor === 'number') return sensor;
  return sensor.ppm ?? sensor.gasLevel ?? 0;
}

const incidentApi = buildIncidentApi({ get, set, update, push });

const watchGasLevel = (callback) => {
  let lastPpm = null;
  const intervalMs = Number(process.env.FIREBASE_POLL_MS) || 3000;
  const threshold = Number(process.env.GAS_THRESHOLD) || 400;

  const poll = async () => {
    try {
      const sensor = await get(paths.sensor);
      const ppm = extractPpm(sensor);
      const status = sensor?.status ?? (ppm >= (sensor?.threshold ?? threshold) ? 'danger' : 'safe');

      if (ppm !== lastPpm) {
        lastPpm = ppm;
        console.log(`📊 Firebase REST update: ${ppm} ppm (${status})`);
      }
      if (typeof callback === 'function') {
        callback({ ppm, status, threshold: sensor?.threshold ?? threshold });
      }
    } catch (error) {
      console.error('Firebase REST poll error:', error.message);
    }
  };

  poll();
  const timer = setInterval(poll, intervalMs);
  return () => clearInterval(timer);
};

const getCurrentGasLevel = async () => extractPpm(await get(paths.sensor));

const getSensorData = async () => get(paths.sensor);

const setRelayCommand = async (state) => {
  await set(paths.relay, {
    state,
    updatedAt: new Date().toISOString(),
  });
};

const getHistory = async (limit = 20) => {
  const data = await get(paths.history);
  if (!data) return [];
  return Object.entries(data)
    .map(([id, val]) => ({ id, ...val }))
    .slice(-limit)
    .reverse();
};

const logReading = async (ppm, status) => {
  await push(paths.history, {
    ppm,
    status,
    timestamp: new Date().toISOString(),
  });
};

const saveSensorReading = async (data) => {
  const ppm = data.ppm ?? data.gasLevel ?? 0;
  const threshold = Number(process.env.GAS_THRESHOLD) || data.threshold || 400;
  const status = data.status ?? (ppm >= threshold ? 'danger' : 'safe');

  const payload = {
    ppm,
    status,
    threshold: data.threshold ?? threshold,
    lastUpdated: new Date().toISOString(),
  };

  await set(paths.sensor, payload);
  await logReading(ppm, status);
  return payload;
};

const initFirebase = () => {
  console.log('✅ Firebase REST ready:', baseUrl);
  console.log(`   Watch: /${paths.sensor}  Relay: /${paths.relay}`);
  if (ignoreSsl) console.warn('⚠️  FIREBASE_IGNORE_SSL=true (dev only)');
  return true;
};

module.exports = {
  initFirebase,
  getCurrentGasLevel,
  getSensorData,
  getHistory,
  logReading,
  saveSensorReading,
  setRelayCommand,
  watchGasLevel,
  ...incidentApi,
};
