// gas-monitor-fixed.js - CORRECTED FOR NODE.JS
const admin = require('firebase-admin');

// Initialize with service account
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://gasleakmonitor-ae209-default-rtdb.europe-west1.firebasedatabase.app'
});

const db = admin.database();

class GasMonitorFixed {
  constructor() {
    this.lastPPM = null;
    this.lastSaveTime = 0;
    this.setupListeners();
  }
  
  setupListeners() {
    // Listen to sensor changes
    const sensorRef = db.ref('gas/sensor');
    sensorRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data && data.ppm !== this.lastPPM) {
        this.handleNewReading(data.ppm);
        this.lastPPM = data.ppm;
      }
    });
    
    console.log("✅ Listening for sensor changes...");
  }
  
  async handleNewReading(ppm) {
    const now = Date.now();
    
    // Prevent duplicate within 1 second
    if (now - this.lastSaveTime < 1000) {
      console.log("⏭️ Skipping duplicate (too fast)");
      return;
    }
    
    // Determine status
    const status = ppm > 100 ? 'danger' : ppm > 50 ? 'warning' : 'safe';
    
    // Save to history
    const historyRef = db.ref('gas/history');
    const newRecordRef = historyRef.push();
    
    try {
      await newRecordRef.set({
        ppm,
        status,
        timestamp: new Date().toISOString(),
        unixTime: now
      });
      
      this.lastSaveTime = now;
      console.log(`✅ Saved reading: ${ppm}ppm (${status})`);
      
      // Clean old records
      await this.cleanOldRecords();
      
    } catch (error) {
      console.error("❌ Error saving:", error);
    }
  }
  
  async cleanOldRecords() {
    const historyRef = db.ref('gas/history');
    const snapshot = await historyRef.once('value');
    
    if (snapshot.exists()) {
      const records = [];
      snapshot.forEach(child => {
        records.push({ key: child.key, ...child.val() });
      });
      
      // Keep only last 1000 records
      if (records.length > 1000) {
        records.sort((a, b) => b.unixTime - a.unixTime);
        const toDelete = records.slice(1000);
        
        const updates = {};
        toDelete.forEach(record => {
          updates[`gas/history/${record.key}`] = null;
        });
        
        await db.ref().update(updates);
        console.log(`🧹 Cleaned ${toDelete.length} old records`);
      }
    }
  }
}

// Start the monitor
console.log("🚀 Starting Gas Monitor...");
const monitor = new GasMonitorFixed();

// Keep process running
process.on('SIGINT', () => {
  console.log("\n👋 Shutting down...");
  process.exit();
});



/* 

https://console.firebase.google.com/project/gasleakmonitor-ae209/database/gasleakmonitor-ae209-default-rtdb/data/~2Fgas~2Fhistory
curl -X PUT -d "{}" "https://console.firebase.google.com/project/gasleakmonitor-ae209/database/gasleakmonitor-ae209-default-rtdb/data/gas/history"



*/