/**
 * Firebase backend — uses REST by default (no SSL/OAuth issues).
 * Set FIREBASE_USE_ADMIN=true to use firebase-admin instead.
 */
const useAdmin = process.env.FIREBASE_USE_ADMIN === 'true';

if (process.env.FIREBASE_IGNORE_SSL === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

if (!useAdmin) {
  module.exports = require('./firebase-rest');
} else {
  const admin = require('firebase-admin');
  const fs = require('fs');
  const path = require('path');
  const paths = require('./paths');
  const { buildIncidentApi } = require('./incidents');

  let serviceAccount;
  const defaultServiceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccountPath = path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      : path.resolve(__dirname, '../../', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    serviceAccount = require(serviceAccountPath);
  } else if (fs.existsSync(defaultServiceAccountPath)) {
    serviceAccount = require(defaultServiceAccountPath);
  } else {
    console.error('❌ Firebase Admin: no service account found');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });

  const db = admin.database();
  console.log('✅ Firebase Admin initialized');

  const extractPpm = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return val.ppm ?? val.gasLevel ?? 0;
  };

  const threshold = Number(process.env.GAS_THRESHOLD) || 400;

  const firebaseGet = async (p) => {
    const snap = await db.ref(p).once('value');
    return snap.val();
  };
  const firebaseSet = async (p, v) => db.ref(p).set(v);
  const firebaseUpdate = async (p, v) => db.ref(p).update(v);
  const firebasePush = async (p, v) => {
    const ref = db.ref(p).push();
    await ref.set(v);
    return { name: ref.key };
  };

  const incidentApi = buildIncidentApi({
    get: firebaseGet,
    set: firebaseSet,
    update: firebaseUpdate,
    push: firebasePush,
  });

  const watchGasLevel = (callback) => {
    const gasRef = db.ref(paths.sensor);
    gasRef.on('value', (snapshot) => {
      const sensor = snapshot.val();
      const ppm = extractPpm(sensor);
      const status = sensor?.status ?? (ppm >= (sensor?.threshold ?? threshold) ? 'danger' : 'safe');
      console.log(`📊 Firebase update: ${ppm} ppm (${status})`);
      if (typeof callback === 'function') {
        callback({ ppm, status, threshold: sensor?.threshold ?? threshold });
      }
    }, (error) => console.error('Firebase watcher error:', error));
    return () => gasRef.off('value');
  };

  const getCurrentGasLevel = async () => {
    const snapshot = await db.ref(paths.sensor).once('value');
    return extractPpm(snapshot.val());
  };

  const setRelayCommand = async (state) => {
    await db.ref(paths.relay).set({
      state,
      updatedAt: new Date().toISOString(),
    });
  };

  const getSensorData = async () => {
    const snapshot = await db.ref(paths.sensor).once('value');
    return snapshot.val();
  };

  const getHistory = async (limit = 20) => {
    const snapshot = await db.ref(paths.history)
      .orderByKey()
      .limitToLast(limit)
      .once('value');
    const history = [];
    snapshot.forEach((child) => {
      history.push({ id: child.key, ...child.val() });
    });
    return history.reverse();
  };

  const logReading = async (ppm, status) => {
    await db.ref(paths.history).push({ ppm, status, timestamp: new Date().toISOString() });
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
    await db.ref(paths.sensor).set(payload);
    await logReading(ppm, status);
    return payload;
  };

  const initFirebase = () => true;

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
}
