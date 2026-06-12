/**
 * NodeMCU v2.1 simulator — writes to /gas/sensor via REST.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const axios = require('axios');
const https = require('https');
const paths = require('./paths');

const baseUrl = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
const threshold = Number(process.env.GAS_THRESHOLD) || 680;
const ignoreSsl = process.env.FIREBASE_IGNORE_SSL === 'true';
const agent = ignoreSsl ? new https.Agent({ rejectUnauthorized: false }) : undefined;

const client = axios.create({ baseURL: baseUrl, httpsAgent: agent });

let tick = 0;

console.log('🤖 NodeMCU v2.1 simulator (REST)');
console.log(`   Path: /${paths.sensor}  threshold: ${threshold}\n`);

const interval = setInterval(async () => {
  tick++;
  let ppm;

  if (tick <= 10) ppm = Math.floor(Math.random() * 200 + 100);
  else if (tick <= 20) ppm = Math.floor(Math.random() * 150 + 700);
  else ppm = Math.floor(Math.random() * 150 + 80);

  const leaking = ppm >= threshold;
  const payload = {
    ppm,
    status: leaking ? 'danger' : 'safe',
    threshold,
    lastUpdated: `sim+${tick * 3}s`,
  };

  try {
    await client.put(`/${paths.sensor}.json`, payload);
    await client.post(`/${paths.history}.json`, {
      ppm,
      status: payload.status,
      timestamp: new Date().toISOString(),
    });
    console.log(`[${new Date().toLocaleTimeString()}] ppm=${ppm} ${leaking ? '⚠ LEAK' : '✓'}`);
  } catch (err) {
    console.error('Simulate error:', err.message);
  }

  if (tick >= 30) {
    console.log('\n✅ Simulation complete.');
    clearInterval(interval);
    process.exit(0);
  }
}, 3000);
