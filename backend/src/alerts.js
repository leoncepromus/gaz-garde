/**
 * Post-notification flow orchestrator.
 *
 * 1. Leak edge  → create incident, voice + SMS, log history
 * 2. Ongoing    → escalate (repeat voice/SMS) until ack or gas safe
 * 3. Safe edge  → resolve incident, all-clear SMS
 */

const {
  watchGasLevel,
  logReading,
  createIncident,
  resolveActiveIncident,
  getActiveIncident,
  recordNotification,
  incrementEscalation,
  updatePeakPpm,
} = require('./firebase');
const { sendVoiceCall, sendSMS, sendSafeNotification } = require('./twilio');
const config = require('./config');

const ESCALATION_MS = Number(process.env.ALERT_ESCALATION_MS) || 3 * 60 * 1000;
const MAX_ESCALATIONS = Number(process.env.ALERT_MAX_ESCALATIONS) || 5;
const HISTORY_INTERVAL_MS = Number(process.env.HISTORY_LOG_MS) || 30000;

let wasLeaking = false;
let lastLoggedStatus = null;
let lastHistoryLog = 0;
let activeIncidentId = null;

async function fireChannels(ppm, incidentId, { escalation = false } = {}) {
  const [callResult, smsResult] = await Promise.allSettled([
    sendVoiceCall(ppm),
    sendSMS(ppm, { escalation }),
  ]);

  const call = callResult.status === 'fulfilled' ? callResult.value : { success: false };
  const sms = smsResult.status === 'fulfilled' ? smsResult.value : { success: false };

  if (incidentId) {
    await recordNotification(incidentId, 'voice', call.success);
    await recordNotification(incidentId, 'sms', sms.success);
  }

  const label = escalation ? 'Escalation' : 'Initial alert';
  console.log(`  ${call.success ? '✅' : '❌'} ${label} voice  ${sms.success ? '✅' : '❌'} ${label} SMS`);
  return { call, sms };
}

async function maybeLogHistory(ppm, status) {
  const now = Date.now();
  const statusChanged = status !== lastLoggedStatus;
  const periodicDuringLeak = status === 'danger' && (now - lastHistoryLog) >= HISTORY_INTERVAL_MS;

  if (statusChanged || periodicDuringLeak) {
    await logReading(ppm, status);
    lastLoggedStatus = status;
    lastHistoryLog = now;
  }
}

function startWatcher() {
  console.log(`👁  Post-notification watcher — threshold ${config.gas.threshold} ppm`);
  console.log(`   Escalation every ${ESCALATION_MS / 1000}s (max ${MAX_ESCALATIONS}) until ack`);

  if (typeof watchGasLevel !== 'function') {
    console.error('❌ watchGasLevel unavailable — check firebase exports');
    return;
  }

  watchGasLevel(async ({ ppm, status }) => {
    try {
      const isLeaking = status === 'danger';
      const now = Date.now();

      await maybeLogHistory(ppm, status);

      if (isLeaking && !wasLeaking) {
        console.log(`\n🚨 LEAK DETECTED: ${ppm} ppm at ${new Date().toISOString()}`);
        wasLeaking = true;

        const incident = await createIncident(ppm);
        activeIncidentId = incident?.id ?? null;

        await fireChannels(ppm, activeIncidentId);

      } else if (isLeaking && wasLeaking) {
        const incident = await getActiveIncident();
        if (incident) {
          activeIncidentId = incident.id;
          await updatePeakPpm(incident.id, ppm);

          if (!incident.acknowledged) {
            const lastAt = incident.lastEscalationAt || incident.startTime;
            const elapsed = now - new Date(lastAt).getTime();
            const level = incident.escalationLevel || 0;

            if (elapsed >= ESCALATION_MS && level < MAX_ESCALATIONS) {
              console.log(`🔁 Escalation ${level + 1}/${MAX_ESCALATIONS} — no ack (${ppm} ppm)`);
              await incrementEscalation(incident.id);
              await fireChannels(ppm, incident.id, { escalation: true });
            }
          }
        }

      } else if (!isLeaking && wasLeaking) {
        console.log(`✅ Gas back to normal: ${ppm} ppm — resetting alarms`);
        wasLeaking = false;
        activeIncidentId = null;

        await resolveActiveIncident(ppm);
        await sendSafeNotification(ppm);

      } else if (!isLeaking) {
        activeIncidentId = null;
      }
    } catch (error) {
      console.error('Alert handler error:', error);
    }
  });
}

module.exports = { startWatcher };
