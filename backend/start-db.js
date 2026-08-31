const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

async function start() {
  try {
    const dbPath = path.join(__dirname, 'db-data');
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath);
    }

    console.log('Starting MongoDB Memory Server on port 27017...');
    const mongoServer = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbPath: dbPath,
        storageEngine: 'wiredTiger'
      }
    });

    console.log(`MongoDB started successfully at: ${mongoServer.getUri()}`);
    console.log('Keep this process running to keep the database active.');
  } catch (err) {
    console.error('Failed to start MongoDB Memory Server:', err);
    process.exit(1);
  }
}

start();
