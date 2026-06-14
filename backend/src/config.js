const path = require('path');
const dotenv = require('dotenv');

[path.join(__dirname, '../../.env'), path.join(__dirname, '../../.env')].forEach((envPath) => {
  dotenv.config({ path: envPath });
});

module.exports = {
  port: process.env.PORT || 3000,

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneFrom: process.env.TWILIO_PHONE_FROM,
    phoneTo: process.env.TWILIO_PHONE_TO,
  },

  africasTalking: {
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
  },

  server: {
    publicUrl: process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`,
  },

  gas: {
    threshold: Number(process.env.GAS_THRESHOLD) || 400,
  },

  alerts: {
    escalationMs: Number(process.env.ALERT_ESCALATION_MS) || 3 * 60 * 1000,
    maxEscalations: Number(process.env.ALERT_MAX_ESCALATIONS) || 5,
  },

  sensor: {
    apiKey: process.env.SENSOR_API_KEY || '',
  },
};
