/**
 * USSD Handler — Africa's Talking
 *
 * Users dial *801*1560# to check gas status or acknowledge an active alert.
 * Callback URL: https://YOUR_NGROK/ussd
 */

const {
  getCurrentGasLevel,
  getHistory,
  getActiveIncident,
  acknowledgeActiveIncident,
} = require('./firebase');
const config = require('./config');

async function handleUSSD(req, res) {
  const { phoneNumber, text } = req.body;
  const input = text ? text.trim() : '';

  let response = '';

  try {
    if (input === '') {
      const active = await getActiveIncident();
      const ackLine = active && !active.acknowledged
        ? '5. Acknowledge active alert\n'
        : '';

      response = `CON GasSafer Monitor\n`
        + `1. Current gas level\n`
        + `2. Last 3 readings\n`
        + `3. System status\n`
        + `4. Emergency contacts\n`
        + ackLine;

    } else if (input === '1') {
      const ppm = await getCurrentGasLevel();
      const status = ppm >= config.gas.threshold ? '⚠ DANGER' : '✓ SAFE';
      response = `END Gas level now: ${ppm} ppm\n`
        + `Status: ${status}\n`
        + `Safe limit: ${config.gas.threshold} ppm\n`
        + `Dial again to refresh.`;

    } else if (input === '2') {
      const readings = await getHistory(3);
      const lines = readings.map((r) => {
        const t = new Date(r.timestamp).toLocaleTimeString('en-RW', {
          timeZone: 'Africa/Kigali', hour: '2-digit', minute: '2-digit',
        });
        return `${t}: ${r.ppm}ppm (${r.status === 'danger' ? '⚠' : '✓'})`;
      }).join('\n');
      response = `END Last 3 readings:\n${lines || 'No data yet.'}`;

    } else if (input === '3') {
      const ppm = await getCurrentGasLevel();
      const active = await getActiveIncident();
      const sensorOk = ppm !== null && ppm >= 0;

      let incidentLine = 'No active incident';
      if (active) {
        incidentLine = active.acknowledged
          ? `Incident acked (${active.ackChannel})`
          : `ACTIVE LEAK — ack via option 5`;
      }

      response = `END System status:\n`
        + `Sensor: ${sensorOk ? '✓ Online' : '✗ Offline'}\n`
        + `Cloud: ✓ Connected\n`
        + `Last reading: ${ppm} ppm\n`
        + `${incidentLine}`;

    } else if (input === '4') {
      response = `END Emergency contacts:\n`
        + `Primary: ${config.twilio.phoneTo}\n`
        + `Fire & rescue: 112\n`
        + `Police: 113`;

    } else if (input === '5') {
      const active = await getActiveIncident();

      if (!active) {
        response = `END No active gas leak alert.\nDial *801*1560# to check status.`;
      } else if (active.acknowledged) {
        response = `END Alert already acknowledged at ${new Date(active.ackAt).toLocaleTimeString('en-RW', { timeZone: 'Africa/Kigali' })}.\nRepeated calls stopped.`;
      } else {
        await acknowledgeActiveIncident({
          by: phoneNumber || 'ussd-user',
          channel: 'ussd',
        });
        response = `END ✓ Alert acknowledged.\n`
          + `Repeated voice/SMS reminders will stop.\n`
          + `Local alarms continue until gas is safe.\n`
          + `Peak level: ${active.peakPpm} ppm`;
      }

    } else {
      response = `END Invalid option.\nDial *801*1560# to start again.`;
    }

  } catch (err) {
    console.error('USSD error:', err.message);
    response = `END Service temporarily unavailable.\nDial *801*1560# to try again.`;
  }

  res.set('Content-Type', 'text/plain');
  res.send(response);
}

module.exports = { handleUSSD };
