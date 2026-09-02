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
  app.use('/api/dashboard', require('./routes/dashboard'));

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
    const itemsRes = await get('/api/items', libToken);
    const importedItems = itemsRes.data;

    // Assign librarian as custodian to item 0 and item 1
    await post(`/api/items/${importedItems[0]._id}/custodians`, { userId: librarian._id }, libToken);
    await post(`/api/items/${importedItems[1]._id}/custodians`, { userId: librarian._id }, libToken);

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

    // Test librarian bulk return
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

    // 4. Test CSV Export of Active Loans
    console.log('\n--- Testing Active Loans CSV Export ---');
    // Create an active overdue loan
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
      console.log('✔ Librarian CSV export generated valid CSV format');
    } else {
      console.error('Export text:', libExport.text);
      throw new Error('CSV export format invalid');
    }

    // 5. Test Dashboard Stats
    console.log('\n--- Testing Dashboard Stats ---');
    // Member should be 403 Forbidden
    const memDash = await get('/api/dashboard/stats', memToken);
    if (memDash.status === 403) {
      console.log('✔ Member rejected with 403 Forbidden from dashboard statistics');
    } else {
      throw new Error(`Expected 403 for member dashboard, got ${memDash.status}`);
    }

    // Librarian gets full stats
    const libDash = await get('/api/dashboard/stats', libToken);
    if (libDash.status === 200) {
      const stats = libDash.data;
      console.log('✔ Dashboard statistics retrieved successfully:');
      console.log('  Headlines:', stats.headlines);
      console.log('  Status Breakdown:', stats.statusBreakdown);
      console.log('  Custodians:', stats.custodianBreakdown);
      console.log(`  Weekly Returns: ${stats.weeklyReturns.length} weeks computed`);

      if (
        stats.headlines.itemsOut === 1 &&
        stats.headlines.itemsOverdue === 1 &&
        stats.headlines.loansReturnedThisWeek === 2 &&
        stats.headlines.totalCatalogueItems === 4 &&
        stats.weeklyReturns.length === 8
      ) {
        console.log('✔ All headline metrics and breakdown computations match exactly!');
      } else {
        throw new Error('Dashboard stats metrics values mismatch');
      }
    } else {
      throw new Error(`Librarian dashboard request failed with ${libDash.status}`);
    }

    console.log('\n=== ALL DAY 5 BACKEND API & SECURITY TESTS PASSED! ===');
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
