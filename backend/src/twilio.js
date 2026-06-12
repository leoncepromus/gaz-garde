const twilio = require('twilio');
const config = require('./config');

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

// ── 1. Automated voice call ───────────────────────────────────────────────
async function sendVoiceCall(ppm) {
  try {
    const call = await client.calls.create({
      to: config.twilio.phoneTo,
      from: config.twilio.phoneFrom,

      // TwiML served from our own Express route /twiml/alert
      url: `${config.server.publicUrl}/twiml/alert?ppm=${ppm}`,

      // Fallback if TwiML URL fails
      statusCallback: `${config.server.publicUrl}/twilio/status`,
      statusCallbackMethod: 'POST',
    });

    console.log(`📞 Voice call initiated: ${call.sid} → ${config.twilio.phoneTo}`);
    return { success: true, sid: call.sid };
  } catch (err) {
    console.error('❌ Voice call failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ── 2. SMS alert ──────────────────────────────────────────────────────────
async function sendSMS(ppm, options = {}) {
  try {
    const kigaliTime = new Date().toLocaleString('en-RW', {
      timeZone: 'Africa/Kigali',
      dateStyle: 'short',
      timeStyle: 'short',
    });

    const header = options.escalation
      ? '🔁 REMINDER — GAS LEAK (no ack yet)'
      : '⚠ GAS LEAK ALERT — GasSafer';

    const message = await client.messages.create({
      to: config.twilio.phoneTo,
      from: config.twilio.phoneFrom,
      body: [
        header,
        `Level: ${ppm} ppm (limit: ${config.gas.threshold} ppm)`,
        `Time: ${kigaliTime} (Kigali)`,
        'Action: Evacuate immediately!',
        options.escalation
          ? 'Acknowledge via GasSafer app or USSD *801*1560# → 5.'
          : 'Open GasSafer app for details.',
      ].join('\n'),
    });

    console.log(`📱 SMS sent: ${message.sid} → ${config.twilio.phoneTo}`);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error('❌ SMS failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ── 3. Safe status SMS (when gas drops back to normal) ────────────────────
async function sendSafeNotification(ppm) {
  try {
    const message = await client.messages.create({
      to: config.twilio.phoneTo,
      from: config.twilio.phoneFrom,
      body: `✅ GasSafer: Gas level back to normal (${ppm} ppm). Situation resolved.`,
    });
    console.log(`📱 Safe SMS sent: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error('❌ Safe SMS failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendVoiceCall, sendSMS, sendSafeNotification };
