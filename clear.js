const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://gasleakmonitor-ae209-default-rtdb.europe-west1.firebasedatabase.app'
});

const db = getDatabase();

async function clearDatabase() {
  console.log("🚀 Clearing database...\n");

  await db.ref('gas/history').remove();
  console.log("✅ gas/history cleared");

  // await db.ref('incidents').remove();
  // console.log("✅ incidents cleared");

  // await db.ref('gas/sensor').set({
  //   ppm: 0,
  //   status: "safe",
  //   timestamp: new Date().toISOString(),
  //   unixTime: Date.now()
  // });
  // console.log("✅ gas/sensor reset");

  // await db.ref('gas/relay').set(false);
  // console.log("✅ gas/relay reset");

  // console.log("\n✨ Done!");
  process.exit(0);
}

clearDatabase().catch(console.error);