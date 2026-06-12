/**
 * Incident lifecycle — cloud record for leak events, ack, and escalation.
 */
const paths = require('./paths');

function buildIncidentApi({ get, set, update, push }) {
  const getIncidents = async (limit = 30) => {
    const data = await get(paths.incidents);
    if (!data) return [];
    return Object.entries(data)
      .map(([id, val]) => ({ id, ...val }))
      .slice(-limit)
      .reverse();
  };

  const getActiveIncident = async () => {
    const data = await get(paths.incidents);
    if (!data) return null;
    const active = Object.entries(data).find(([, v]) => v.status === 'active');
    if (!active) return null;
    return { id: active[0], ...active[1] };
  };

  const createIncident = async (peakPpm) => {
    const existing = await getActiveIncident();
    if (existing) return existing;

    const payload = {
      type: 'leak',
      peakPpm,
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'active',
      acknowledged: false,
      ackAt: null,
      ackBy: null,
      ackChannel: null,
      escalationLevel: 0,
      lastEscalationAt: null,
      notificationsSent: [],
      channels: { voice: false, sms: false, push: false, ussd: false },
    };

    const result = await push(paths.incidents, payload);
    const id = result?.name ?? result;
    return { id, ...payload };
  };

  const resolveActiveIncident = async (finalPpm) => {
    const active = await getActiveIncident();
    if (!active) return null;

    const updates = {
      status: 'resolved',
      endTime: new Date().toISOString(),
      peakPpm: Math.max(active.peakPpm ?? 0, finalPpm),
    };
    await update(`${paths.incidents}/${active.id}`, updates);
    return { ...active, ...updates };
  };

  const acknowledgeIncident = async (id, { by, channel }) => {
    const incident = await get(`${paths.incidents}/${id}`);
    if (!incident) return null;
    if (incident.acknowledged) return { id, ...incident };

    const updates = {
      acknowledged: true,
      ackAt: new Date().toISOString(),
      ackBy: by ?? 'unknown',
      ackChannel: channel ?? 'unknown',
    };
    await update(`${paths.incidents}/${id}`, updates);
    return { id, ...incident, ...updates };
  };

  const acknowledgeActiveIncident = async ({ by, channel }) => {
    const active = await getActiveIncident();
    if (!active) return null;
    return acknowledgeIncident(active.id, { by, channel });
  };

  const recordNotification = async (id, channel, success) => {
    const incident = await get(`${paths.incidents}/${id}`);
    if (!incident) return;

    const entry = { channel, at: new Date().toISOString(), success: !!success };
    const notificationsSent = [...(incident.notificationsSent || []), entry];
    const channels = { ...(incident.channels || {}), [channel]: !!success };

    await update(`${paths.incidents}/${id}`, { notificationsSent, channels });
  };

  const incrementEscalation = async (id) => {
    const incident = await get(`${paths.incidents}/${id}`);
    if (!incident) return;

    await update(`${paths.incidents}/${id}`, {
      escalationLevel: (incident.escalationLevel || 0) + 1,
      lastEscalationAt: new Date().toISOString(),
      peakPpm: incident.peakPpm,
    });
  };

  const updatePeakPpm = async (id, ppm) => {
    const incident = await get(`${paths.incidents}/${id}`);
    if (!incident || ppm <= (incident.peakPpm || 0)) return;
    await update(`${paths.incidents}/${id}`, { peakPpm: ppm });
  };

  return {
    getIncidents,
    getActiveIncident,
    createIncident,
    resolveActiveIncident,
    acknowledgeIncident,
    acknowledgeActiveIncident,
    recordNotification,
    incrementEscalation,
    updatePeakPpm,
  };
}

module.exports = { buildIncidentApi };
