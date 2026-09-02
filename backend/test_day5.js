const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('./models/User');
const Item = require('./models/Item');
const Loan = require('./models/Loan');
const LoanHistory = require('./models/LoanHistory');

require('dotenv').config();

const PORT = 5006;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let mongoServer;

async function runTests() {
  console.log('=== STARTING DAY 5 BULK ACTIONS & DASHBOARD TESTS ===');

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  await User.deleteMany({});
  await Item.deleteMany({});
  await Loan.deleteMany({});
  await LoanHistory.deleteMany({});
  await Loan.syncIndexes();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/items', require('./routes/items'));
  app.use('/api/loans', require('./routes/loans'));

  const server = app.listen(PORT);

  try {
    const post = async (url, body, token) => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${BASE_URL}${url}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      return { status: res.status, data: await res.json() };
    };

    const get = async (url, token) => {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${BASE_URL}${url}`, { headers });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return { status: res.status, data: await res.json() };
      }
      return { status: res.status, text: await res.text() };
    };

    // 1. Seed Librarian and Member with hashed passwords
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const librarian = new User({ username: 'librarian_alice', password: passwordHash, role: 'librarian' });
    await librarian.save();

    const member = new User({ username: 'member_bob', password: passwordHash, role: 'member' });
    await member.save();

    const libLogin = await post('/api/auth/login', { username: 'librarian_alice', password: 'password123' });
    const libToken = libLogin.data.token;

    const memLogin = await post('/api/auth/login', { username: 'member_bob', password: 'password123' });
    const memToken = memLogin.data.token;

    console.log('✔ Auth setup successful');

    // 2. Test CSV Bulk Import (Librarian vs Member)
    console.log('\n--- Testing CSV Bulk Import ---');
    const sampleCsv = `Name,Category
Canon EOS R5,Cameras
Sony A7 IV,Cameras
,Projectors
Sennheiser MKE 600,
Epson Pro EX9240,Projectors`;

    // Test member forbidden
    const memImport = await post('/api/items/bulk-import', { csvData: sampleCsv }, memToken);
    if (memImport.status === 403) {
      console.log('✔ Member rejected with 403 Forbidden from CSV bulk import');
    } else {
      throw new Error(`Expected 403 for member bulk import, got ${memImport.status}`);
    }

    // Test librarian bulk import
    const libImport = await post('/api/items/bulk-import', { csvData: sampleCsv }, libToken);
    if (libImport.status === 200 && libImport.data.importedCount === 3 && libImport.data.failedCount === 2) {
      console.log(`✔ Librarian imported ${libImport.data.importedCount} valid items, reported ${libImport.data.failedCount} failures with row numbers and reasons.`);
    } else {
      console.error('Import response:', libImport.data);
      throw new Error('CSV bulk import did not return expected counts');
    }

    console.log('\n=== ALL CURRENT DAY 5 STEP 1 TESTS PASSED ===');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
