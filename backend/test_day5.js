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

    const patch = async (url, body, token) => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${BASE_URL}${url}`, {
        method: 'PATCH',
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
Sennheiser MKE 600,Audio
Epson Pro EX9240,Projectors`;

    const memImport = await post('/api/items/bulk-import', { csvData: sampleCsv }, memToken);
    if (memImport.status === 403) {
      console.log('✔ Member rejected with 403 Forbidden from CSV bulk import');
    } else {
      throw new Error(`Expected 403 for member bulk import, got ${memImport.status}`);
    }

    const libImport = await post('/api/items/bulk-import', { csvData: sampleCsv }, libToken);
    if (libImport.status === 200 && libImport.data.importedCount === 4 && libImport.data.failedCount === 1) {
      console.log(`✔ Librarian imported ${libImport.data.importedCount} items, reported ${libImport.data.failedCount} failures with row numbers and reasons.`);
    } else {
      console.error('Import response:', libImport.data);
      throw new Error('CSV bulk import did not return expected counts');
    }

    // 3. Test Bulk Return
    console.log('\n--- Testing Bulk Return ---');
    // Fetch imported items to create loans
    const itemsRes = await get('/api/items', libToken);
    const importedItems = itemsRes.data;

    // Create 3 loans: 2 Issued, 1 Requested
    const loan1Res = await post('/api/loans', {
      itemId: importedItems[0]._id,
      borrowerId: member._id,
      dueDate: new Date(Date.now() + 86400000),
      status: 'Issued'
    }, libToken);
    const loan1Id = loan1Res.data._id;

    const loan2Res = await post('/api/loans', {
      itemId: importedItems[1]._id,
      borrowerId: member._id,
      dueDate: new Date(Date.now() + 86400000),
      status: 'Issued'
    }, libToken);
    const loan2Id = loan2Res.data._id;

    const loan3Res = await post('/api/loans', {
      itemId: importedItems[2]._id,
      borrowerId: member._id,
      dueDate: new Date(Date.now() + 86400000),
      status: 'Requested'
    }, libToken);
    const loan3Id = loan3Res.data._id;

    // Test member rejected from bulk-return
    const memBulkReturn = await post('/api/loans/bulk-return', { loanIds: [loan1Id] }, memToken);
    if (memBulkReturn.status === 403) {
      console.log('✔ Member rejected with 403 Forbidden from bulk return');
    } else {
      throw new Error(`Expected 403 for member bulk return, got ${memBulkReturn.status}`);
    }

    // Test librarian bulk return with a mix: loan1 (Issued), loan3 (Requested - invalid), and a fake ID
    const fakeId = new mongoose.Types.ObjectId().toString();
    const libBulkReturn = await post('/api/loans/bulk-return', {
      loanIds: [loan1Id, loan2Id, loan3Id, fakeId],
      note: 'Returned via test'
    }, libToken);

    if (libBulkReturn.status === 200 && libBulkReturn.data.successCount === 2 && libBulkReturn.data.rejectedCount === 2) {
      console.log(`✔ Bulk return successfully processed: ${libBulkReturn.data.successCount} returned, ${libBulkReturn.data.rejectedCount} rejected with specific reasons.`);
    } else {
      console.error('Bulk return response:', libBulkReturn.data);
      throw new Error('Bulk return response counts mismatch');
    }

    // Verify database state: items 0 and 1 are available, loan1 and loan2 status is Returned
    const checkLoan1 = await get(`/api/loans/${loan1Id}`, libToken);
    if (checkLoan1.data.status === 'Returned' && checkLoan1.data.item.status === 'available') {
      console.log('✔ Verified loan state is Returned and item status reset to available');
    } else {
      throw new Error('Database state mismatch after bulk return');
    }

    // 4. Test CSV Export of Active Loans
    console.log('\n--- Testing Active Loans CSV Export ---');
    // Create another issued loan so we have an active loan to export
    await post('/api/loans', {
      itemId: importedItems[0]._id,
      borrowerId: member._id,
      dueDate: new Date(Date.now() - 86400000), // Overdue
      status: 'Issued'
    }, libToken);

    // Test member rejected from export
    const memExport = await get('/api/loans/export', memToken);
    if (memExport.status === 403) {
      console.log('✔ Member rejected with 403 Forbidden from CSV export');
    } else {
      throw new Error(`Expected 403 for member export, got ${memExport.status}`);
    }

    // Test librarian export
    const libExport = await get('/api/loans/export', libToken);
    if (libExport.status === 200 && libExport.text.includes('Item Name,Category,Borrower,Borrow Date,Due Date,Overdue')) {
      console.log('✔ Librarian CSV export generated valid CSV format:');
      console.log(libExport.text.trim());
    } else {
      console.error('Export text:', libExport.text);
      throw new Error('CSV export format invalid');
    }

    console.log('\n=== ALL CURRENT BULK ACTION TESTS PASSED ===');
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
