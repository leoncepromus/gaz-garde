const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://gasleakmonitor-ae209-default-rtdb.europe-west1.firebasedatabase.app'
});

const db = getDatabase();

async function deleteInBatches(path, batchSize = 100) {
  console.log(`🗑️  Deleting ${path} in batches of ${batchSize}...`);
  let totalDeleted = 0;

  while (true) {
    // Fetch only keys (shallow) for one batch
    const snapshot = await db.ref(path).orderByKey().limitToFirst(batchSize).get();

    if (!snapshot.exists()) {
      console.log(`✅ ${path} fully cleared (${totalDeleted} records deleted)`);
      break;
    }

    const keys = Object.keys(snapshot.val());
    
    // Build a multi-path delete update
    const updates = {};
    keys.forEach(key => { updates[`${path}/${key}`] = null; });

    await db.ref('/').update(updates);
    totalDeleted += keys.length;
    console.log(`   ... deleted ${totalDeleted} records so far`);
  }
}

async function clearDatabase() {
  console.log("🚀 Clearing database...\n");

  await deleteInBatches('gas/history', 100);
  await deleteInBatches('incidents', 100);

  await db.ref('gas/sensor').set({
    ppm: 0,
    status: "safe",
    timestamp: new Date().toISOString(),
    unixTime: Date.now()
  });
  console.log("✅ gas/sensor reset");

  await db.ref('gas/relay').set(false);
  console.log("✅ gas/relay reset");

  console.log("\n✨ Done!");
  process.exit(0);
}

clearDatabase().catch(console.error);