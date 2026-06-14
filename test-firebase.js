const https = require('https');

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const WEB_API_KEY  = 'AIzaSyCIuaW71JdyHdNywyo7E_gt9jMs1xWAwTk';   // Firebase Console → Project Settings → General
const EMAIL        = 'test@gasmonitor.local';
const PASSWORD     = 'promisleo@2o19';
const DB_URL       = 'https://gasleakmonitor-ae209-default-rtdb.europe-west1.firebasedatabase.app';
// ────────────────────────────────────────────────────────────────────────────

const NOW      = Date.now();
const ISO_NOW  = new Date(NOW).toISOString();

let passed = 0;
let failed = 0;

// ─── HTTP helpers ────────────────────────────────────────────────────────────
function request(url, method, body) {
  return new Promise((resolve, reject) => {
    const data    = body ? JSON.stringify(body) : null;
    const urlObj  = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname + urlObj.search,
      method,
      headers:  { 'Content-Type': 'application/json', ...(data && { 'Content-Length': Buffer.byteLength(data) }) }
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const db = (path, token) => `${DB_URL}/${path}.json?auth=${token}`;

// ─── Logging ─────────────────────────────────────────────────────────────────
function log(label, ok, status, detail = '') {
  const icon = ok ? '✅' : '❌';
  const tag  = ok ? 'PASS' : 'FAIL';
  if (ok) passed++; else failed++;
  console.log(`${icon} [${tag}] ${label} (HTTP ${status}) ${detail}`);
}

function section(title) {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(55));
}

// ─── 1. AUTH ─────────────────────────────────────────────────────────────────
async function getToken() {
  section('1. Authentication');
  const res = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`,
    'POST',
    { email: EMAIL, password: PASSWORD, returnSecureToken: true }
  );
  if (res.status === 200 && res.body.idToken) {
    log('Sign in', true, res.status, `user: ${res.body.email}`);
    return res.body.idToken;
  }
  log('Sign in', false, res.status, res.body.error?.message || '');
  throw new Error('Authentication failed — check WEB_API_KEY / EMAIL / PASSWORD');
}

// ─── 2. SENSOR ───────────────────────────────────────────────────────────────
async function testSensor(token) {
  section('2. gas/sensor');

  // Valid write
  let res = await request(db('gas/sensor', token), 'PUT', {
    ppm: 45, status: 'safe', timestamp: ISO_NOW, unixTime: NOW
  });
  log('Write valid sensor data', res.status === 200, res.status);

  // Read back
  res = await request(db('gas/sensor', token), 'GET');
  const ok = res.status === 200 && res.body?.ppm === 45;
  log('Read sensor — ppm matches', ok, res.status, ok ? `ppm=${res.body.ppm}` : JSON.stringify(res.body));

  // ppm > 1000 — should fail (400)
  res = await request(db('gas/sensor', token), 'PUT', {
    ppm: 9999, status: 'safe', timestamp: ISO_NOW
  });
  log('Reject ppm > 1000', res.status === 400, res.status);

  // Invalid status — should fail
  res = await request(db('gas/sensor', token), 'PUT', {
    ppm: 50, status: 'unknown', timestamp: ISO_NOW
  });
  log('Reject invalid status', res.status === 400, res.status);

  // Missing timestamp — should fail
  res = await request(db('gas/sensor', token), 'PUT', {
    ppm: 50, status: 'safe'
  });
  log('Reject missing timestamp', res.status === 400, res.status);

  // Unauthenticated — should fail (401)
  res = await request(`${DB_URL}/gas/sensor.json`, 'GET');
  log('Reject unauthenticated read', res.status === 401, res.status);
}

// ─── 3. RELAY ────────────────────────────────────────────────────────────────
async function testRelay(token) {
  section('3. gas/relay');

  let res = await request(db('gas/relay', token), 'PUT', true);
  log('Write relay true', res.status === 200, res.status);

  res = await request(db('gas/relay', token), 'GET');
  log('Read relay — value is true', res.status === 200 && res.body === true, res.status, `value=${res.body}`);

  res = await request(db('gas/relay', token), 'PUT', false);
  log('Write relay false', res.status === 200, res.status);

  // Non-boolean — should fail
  res = await request(db('gas/relay', token), 'PUT', "on");
  log('Reject non-boolean relay', res.status === 400, res.status);
}

// ─── 4. HISTORY ──────────────────────────────────────────────────────────────
async function testHistory(token) {
  section('4. gas/history');

  // Valid entry
  let res = await request(db('gas/history', token), 'POST', {
    ppm: 120, status: 'warning', timestamp: ISO_NOW, unixTime: NOW
  });
  log('POST valid history entry', res.status === 200, res.status, `key=${res.body?.name}`);

  // Read history
  res = await request(db('gas/history', token), 'GET');
  const count = res.body ? Object.keys(res.body).length : 0;
  log('Read history entries', res.status === 200 && count > 0, res.status, `${count} record(s)`);

  // Missing unixTime — should fail
  res = await request(db('gas/history', token), 'POST', {
    ppm: 50, status: 'safe', timestamp: ISO_NOW
  });
  log('Reject missing unixTime', res.status === 400, res.status);

  // Future unixTime — should fail
  res = await request(db('gas/history', token), 'POST', {
    ppm: 50, status: 'safe', timestamp: ISO_NOW, unixTime: NOW + 9999999999
  });
  log('Reject future unixTime', res.status === 400, res.status);
}

// ─── 5. INCIDENTS ────────────────────────────────────────────────────────────
async function testIncidents(token) {
  section('5. incidents');

  // Valid incident
  let res = await request(db('incidents', token), 'POST', {
    startTime: NOW, status: 'active', maxPpm: 200, duration: 0
  });
  log('POST valid incident', res.status === 200, res.status, `key=${res.body?.name}`);

  // Read
  res = await request(db('incidents', token), 'GET');
  const count = res.body ? Object.keys(res.body).length : 0;
  log('Read incidents', res.status === 200 && count > 0, res.status, `${count} record(s)`);

  // Invalid status
  res = await request(db('incidents', token), 'POST', {
    startTime: NOW, status: 'pending'
  });
  log('Reject invalid incident status', res.status === 400, res.status);

  // Missing startTime
  res = await request(db('incidents', token), 'POST', {
    status: 'active'
  });
  log('Reject missing startTime', res.status === 400, res.status);
}

// ─── 6. SECURITY ─────────────────────────────────────────────────────────────
async function testSecurity(token) {
  section('6. Security — blocked paths');

  // $other rule blocks unknown paths
  let res = await request(db('unknown_path', token), 'GET');
  log('Block read on unknown path', res.status === 401 || res.status === 403, res.status);

  res = await request(db('unknown_path', token), 'PUT', { x: 1 });
  log('Block write on unknown path', res.status === 401 || res.status === 403, res.status);
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
function summary() {
  const total = passed + failed;
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  RESULTS: ${passed}/${total} passed`);
  if (failed === 0) {
    console.log('  🎉 All tests passed!');
  } else {
    console.log(`  ⚠️  ${failed} test(s) failed — check output above`);
  }
  console.log('═'.repeat(55));
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Firebase Test Suite');
  console.log(`   DB: ${DB_URL}`);
  console.log(`   Time: ${ISO_NOW}`);

  const token = await getToken();

  await testSensor(token);
  await testRelay(token);
  await testHistory(token);
  await testIncidents(token);
  await testSecurity(token);

  summary();
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});