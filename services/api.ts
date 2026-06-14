/**
 * GasSafer REST client — mirrors backend OpenAPI (Swagger) endpoints.
 * Live sensor stream: Firebase (services/firebase.ts).
 */

let apiBaseOverride: string | null = null;

export function configureApiBaseUrl(url?: string) {
  const trimmed = url?.trim();
  apiBaseOverride = trimmed ? trimmed.replace(/\/$/, '') : null;
}

export function getApiBaseUrl() {
  return apiBaseOverride ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
}

// ── OpenAPI schemas ─────────────────────────────────────────────────────────

export type ServiceInfo = {
  service: string;
  status: string;
  version?: string;
  docs?: string;
  firebase?: string;
  threshold?: string;
};

export type HealthStatus = {
  status: string;
  timestamp: string;
};

export type GasReading = {
  ppm: number;
  status: 'safe' | 'danger';
  threshold: number;
  timestamp: string;
};

export type SensorData = {
  ppm?: number;
  gasLevel?: number;
  status: 'safe' | 'danger';
  threshold?: number;
  electricity?: 'on' | 'off';
  fan?: 'on' | 'off';
  rssi?: number | null;
  lastUpdated?: string;
  updatedAt?: string;
  timestamp?: string;
};

export type SensorInput = {
  gasLevel?: number;
  ppm?: number;
  status?: 'safe' | 'danger';
  threshold?: number;
  electricity?: 'on' | 'off';
  fan?: 'on' | 'off';
  rssi?: number;
};

export type HistoryEntry = {
  id?: string;
  ppm: number;
  status: 'safe' | 'danger';
  timestamp: string;
};

export type ChannelResult = {
  success: boolean;
  sid?: string;
  error?: string;
};

export type AlertResult = {
  call: ChannelResult;
  sms: ChannelResult;
};

export type SafeAlertResult = {
  sms: ChannelResult;
};

export type SensorPostResult = {
  success: boolean;
  data: SensorData;
};

export type Incident = {
  id: string;
  type: 'leak';
  peakPpm: number;
  startTime: string;
  endTime?: string | null;
  status: 'active' | 'resolved';
  acknowledged?: boolean;
  ackAt?: string | null;
  ackChannel?: string | null;
  escalationLevel?: number;
  channels?: Record<string, boolean>;
  notificationsSent?: { channel: string; at: string; success: boolean }[];
};

export type UssdInput = {
  sessionId?: string;
  serviceCode?: string;
  phoneNumber?: string;
  text?: string;
};

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  return res.json();
}

async function requestText(path: string, options?: RequestInit): Promise<string> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, options);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `API error ${res.status}`);
  }

  return res.text();
}

/** Extract ppm from sensor payload (backend may use ppm or gasLevel). */
export function sensorPpm(sensor: SensorData): number {
  return sensor.ppm ?? sensor.gasLevel ?? 0;
}

// ── API surface (Swagger paths) ─────────────────────────────────────────────

export const api = {
  get baseUrl() {
    return getApiBaseUrl();
  },

  docsUrl: () => `${getApiBaseUrl()}/api/docs`,

  /** GET / — Service info */
  getServiceInfo: (): Promise<ServiceInfo> => requestJson('/'),

  /** GET /health — Health check */
  checkHealth: (): Promise<HealthStatus> => requestJson('/health'),

  /** GET /api/gas — Current gas level */
  getGas: (): Promise<GasReading> => requestJson('/api/gas'),

  /** GET /api/sensor — Full sensor state */
  getSensor: (): Promise<SensorData> => requestJson('/api/sensor'),

  /** POST /api/sensor — Ingest reading (NodeMCU / simulate) */
  postSensor: (
    input: SensorInput,
    sensorApiKey?: string,
  ): Promise<SensorPostResult> =>
    requestJson('/api/sensor', {
      method: 'POST',
      headers: sensorApiKey ? { 'X-Sensor-Key': sensorApiKey } : undefined,
      body: JSON.stringify({
        ...input,
        gasLevel: input.gasLevel ?? input.ppm,
        ppm: input.ppm ?? input.gasLevel,
      }),
    }),

  /** GET /api/history — Reading history */
  getHistory: (limit = 20): Promise<HistoryEntry[]> =>
    requestJson(`/api/history?limit=${limit}`),

  /** POST /api/test-alert — Trigger test alert (voice + SMS) */
  triggerTestAlert: (ppm: number): Promise<AlertResult> =>
    requestJson('/api/test-alert', {
      method: 'POST',
      body: JSON.stringify({ ppm }),
    }),

  /** POST /api/safe-alert — Send all-clear SMS */
  triggerSafeAlert: (ppm: number): Promise<SafeAlertResult> =>
    requestJson('/api/safe-alert', {
      method: 'POST',
      body: JSON.stringify({ ppm }),
    }),

  /** POST /ussd — Africa's Talking USSD callback (simulate menu) */
  postUssd: (input: UssdInput = {}): Promise<string> => {
    const params = new URLSearchParams();
    params.set('sessionId', input.sessionId ?? `app-${Date.now()}`);
    params.set('serviceCode', input.serviceCode ?? '*801*1560#');
    params.set('phoneNumber', input.phoneNumber ?? '+250796233029');
    params.set('text', input.text ?? '');

    return requestText('/ussd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  },

  /** POST /api/relay — Lamp relay (extension, not in public Swagger tag list) */
  setRelay: (state: 'on' | 'off' | 'auto'): Promise<{ success: boolean; state: string }> =>
    requestJson('/api/relay', {
      method: 'POST',
      body: JSON.stringify({ state }),
    }),

  /** GET /api/incidents/active */
  getActiveIncident: (): Promise<Incident | null> =>
    requestJson('/api/incidents/active'),

  /** GET /api/incidents */
  getIncidents: (limit = 30): Promise<Incident[]> =>
    requestJson(`/api/incidents?limit=${limit}`),

  /** POST /api/incidents/:id/ack */
  acknowledgeIncident: (
    id: string,
    channel: 'app' | 'ussd' = 'app',
  ): Promise<{ success: boolean; incident: Incident }> =>
    requestJson(`/api/incidents/${id}/ack`, {
      method: 'POST',
      body: JSON.stringify({ channel, by: 'mobile-user' }),
    }),
};

export default api;
