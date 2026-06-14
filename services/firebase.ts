import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getDatabase, ref, onValue, update, set,
  push, query, limitToLast, get, type Database,
} from 'firebase/database';
import { publicFirebaseConfig } from '../config/firebase';

/** v2.1 Firebase paths */
export const FB_PATHS = {
  sensor: 'gas/sensor',
  relay: 'gas/relay',
  history: 'gas/history',
  incidents: 'incidents',
} as const;

function buildConfig() {
  const databaseURL = (
    process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL
    ?? process.env.FIREBASE_DATABASE_URL
    ?? publicFirebaseConfig.databaseURL
  ).replace(/\/$/, '');

  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? publicFirebaseConfig.apiKey,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? publicFirebaseConfig.authDomain,
    databaseURL,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
      ?? process.env.FIREBASE_PROJECT_ID
      ?? publicFirebaseConfig.projectId,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? publicFirebaseConfig.storageBucket,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
      ?? publicFirebaseConfig.messagingSenderId,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? publicFirebaseConfig.appId,
  };
}

let app: FirebaseApp;
let db: Database;

function getFirebase() {
  if (!app) {
    const config = buildConfig();
    if (!config.databaseURL || !config.projectId) {
      throw new Error(
        'Firebase config missing. Set EXPO_PUBLIC_FIREBASE_DATABASE_URL in .env',
      );
    }
    app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    db = getDatabase(app);
  }
  return { app, db };
}

export { getFirebase };

export type SensorData = {
  rssi: undefined;
  gasLevel: number;
  status: 'safe' | 'danger';
  electricity: 'on' | 'off';
  fan: 'on' | 'off';
  threshold: number;
  lastUpdated?: string;
};

function parseSensor(raw: Record<string, unknown> | null): SensorData | null {
  if (!raw) return null;
  const ppm = (raw.ppm ?? raw.gasLevel) as number | undefined;
  if (ppm === undefined || ppm === null) return null;

  const status = (raw.status as 'safe' | 'danger') ?? 'safe';
  const leaking = status === 'danger';

  return {
    gasLevel: ppm,
    status,
    // v2.1: fan/lamp controlled locally — derive display state from status
    electricity: leaking ? 'off' : 'on',
    fan: leaking ? 'on' : 'off',
    threshold: (raw.threshold as number) ?? 400,
    lastUpdated: raw.lastUpdated as string | undefined,
  };
}

export const subscribeToSensor = (callback: (data: SensorData) => void) => {
  const { db: database } = getFirebase();
  return onValue(ref(database, FB_PATHS.sensor), (snapshot) => {
    const parsed = parseSensor(snapshot.val());
    if (parsed) callback(parsed);
  });
};

export const subscribeToGasLevel = (callback: (ppm: number) => void) => {
  const { db: database } = getFirebase();
  return onValue(ref(database, FB_PATHS.sensor), (snapshot) => {
    const parsed = parseSensor(snapshot.val());
    if (parsed) callback(parsed.gasLevel);
  });
};

export const logReading = async (ppm: number, status: 'safe' | 'danger') => {
  try {
    const { db: database } = getFirebase();
    await push(ref(database, FB_PATHS.history), {
      ppm,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('logReading failed:', e);
  }
};

export const fetchHistory = async (limit = 20) => {
  try {
    const { db: database } = getFirebase();
    const histRef = query(ref(database, FB_PATHS.history), limitToLast(limit));
    const snapshot = await get(histRef);
    if (!snapshot.exists()) return [];
    return Object.values(snapshot.val() as Record<string, unknown>).reverse();
  } catch {
    return [];
  }
};

export const getCurrentGasLevel = async (): Promise<number | null> => {
  try {
    const { db: database } = getFirebase();
    const snapshot = await get(ref(database, FB_PATHS.sensor));
    const parsed = parseSensor(snapshot.val());
    return parsed?.gasLevel ?? null;
  } catch {
    return null;
  }
};

/** v2.1 — lamp relay command only (fan is local on device) */
export const setLampRelay = async (state: 'on' | 'off') => {
  const { db: database } = getFirebase();
  await set(ref(database, FB_PATHS.relay), {
    state,
    updatedAt: new Date().toISOString(),
  });
};

export const clearLampRelay = async () => {
  const { db: database } = getFirebase();
  await set(ref(database, FB_PATHS.relay), {
    state: 'auto',
    updatedAt: new Date().toISOString(),
  });
};

/** @deprecated use setLampRelay — fan is not remotely controlled in v2.1 */
export const setManualRelayControl = async (
  electricity: 'on' | 'off',
  _fan: 'on' | 'off',
) => setLampRelay(electricity);

export const clearManualRelayControl = clearLampRelay;

export type NotificationRecord = {
  channel: string;
  at: string;
  success: boolean;
};

export type Incident = {
  id?: string;
  type: 'leak';
  peakPpm: number;
  startTime: string;
  endTime?: string | null;
  status: 'active' | 'resolved';
  acknowledged?: boolean;
  ackAt?: string | null;
  ackBy?: string | null;
  ackChannel?: 'app' | 'ussd' | string | null;
  escalationLevel?: number;
  lastEscalationAt?: string | null;
  notificationsSent?: NotificationRecord[];
  channels?: Record<string, boolean>;
};

export const getActiveIncident = async (): Promise<Incident | null> => {
  try {
    const { db: database } = getFirebase();
    const snapshot = await get(ref(database, FB_PATHS.incidents));
    if (!snapshot.exists()) return null;

    const entries = Object.entries(snapshot.val() as Record<string, Omit<Incident, 'id'>>);
    const active = entries.find(([, v]) => v.status === 'active');
    if (!active) return null;
    return { id: active[0], ...active[1] };
  } catch {
    return null;
  }
};

export const subscribeToActiveIncident = (callback: (incident: Incident | null) => void) => {
  const { db: database } = getFirebase();
  return onValue(ref(database, FB_PATHS.incidents), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    const entries = Object.entries(snapshot.val() as Record<string, Omit<Incident, 'id'>>);
    const active = entries.find(([, v]) => v.status === 'active');
    callback(active ? { id: active[0], ...active[1] } : null);
  });
};

export const acknowledgeIncident = async (
  id: string,
  channel: 'app' | 'ussd' = 'app',
  by = 'mobile-user',
) => {
  const { db: database } = getFirebase();
  await update(ref(database, `${FB_PATHS.incidents}/${id}`), {
    acknowledged: true,
    ackAt: new Date().toISOString(),
    ackBy: by,
    ackChannel: channel,
  });
};

export const markPushDelivered = async (id: string) => {
  try {
    const { db: database } = getFirebase();
    const snap = await get(ref(database, `${FB_PATHS.incidents}/${id}`));
    const current = snap.val() as Incident | null;
    if (!current) return;
    await update(ref(database, `${FB_PATHS.incidents}/${id}`), {
      channels: { ...(current.channels || {}), push: true },
    });
  } catch (e) {
    console.warn('markPushDelivered failed:', e);
  }
};

export const fetchIncidents = async (limit = 30): Promise<Incident[]> => {
  try {
    const { db: database } = getFirebase();
    const histRef = query(ref(database, FB_PATHS.incidents), limitToLast(limit));
    const snapshot = await get(histRef);
    if (!snapshot.exists()) return [];
    return Object.entries(snapshot.val() as Record<string, Incident>)
      .map(([id, data]) => ({ id, ...data }))
      .reverse();
  } catch {
    return [];
  }
};
