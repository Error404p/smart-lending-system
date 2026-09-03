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

const PORT = 5007;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let mongoServer;
let server;

async function runAudit() {
  console.log('====================================================');
  console.log('🔍 FINAL ROLE-ENFORCEMENT AUDIT & SECURITY TEST SUITE');
  console.log('====================================================\n');

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

  server = app.listen(PORT);

  const post = async (url, body, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    let data;
    try { data = await res.json(); } catch (e) { data = null; }
    return { status: res.status, data };
  };

  const patch = async (url, body, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body)
    });
    let data;
    try { data = await res.json(); } catch (e) { data = null; }
    return { status: res.status, data };
  };

  const del = async (url, token) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'DELETE',
      headers
    });
    let data;
    try { data = await res.json(); } catch (e) { data = null; }
    return { status: res.status, data };
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

  try {
    // 1. Setup Librarian and Members
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const librarian = await User.create({
      username: 'audit_librarian',
      password: passwordHash,
      role: 'librarian'
    });

    const member1 = await User.create({
      username: 'audit_member1',
      password: passwordHash,
      role: 'member'
    });

    const member2 = await User.create({
      username: 'audit_member2',
      password: passwordHash,
      role: 'member'
    });

    // Login users
    const libLogin = await post('/api/auth/login', { username: 'audit_librarian', password: 'password123' });
    const libToken = libLogin.data.token;

    const mem1Login = await post('/api/auth/login', { username: 'audit_member1', password: 'password123' });
    const mem1Token = mem1Login.data.token;

    const mem2Login = await post('/api/auth/login', { username: 'audit_member2', password: 'password123' });
    const mem2Token = mem2Login.data.token;

    console.log('✔ Test accounts provisioned & authenticated.');

    // Create test item & test loans
    const itemA = await Item.create({ name: 'MacBook Air M2', category: 'Laptops' });
    const itemB = await Item.create({ name: 'Canon DSLR', category: 'Cameras' });

    // Loan for member1 (Issued)
    const loan1 = await Loan.create({
      item: itemA._id,
      borrower: member1._id,
      dueDate: new Date(Date.now() - 86400000), // Overdue
      status: 'Issued'
    });

    // Loan for member2 (Requested)
    const loan2 = await Loan.create({
      item: itemB._id,
      borrower: member2._id,
      dueDate: new Date(Date.now() + 86400000 * 5),
      status: 'Requested'
    });

    let passedChecks = 0;
    const assertForbidden = (res, endpointDesc) => {
      if (res.status === 403) {
        console.log(`  [PASS 403 Forbidden] ${endpointDesc}`);
        passedChecks++;
      } else {
        throw new Error(`SECURITY VULNERABILITY: ${endpointDesc} returned ${res.status} instead of 403 Forbidden!`);
      }
    };

    console.log('\n--- 1. Testing Auth & User Management Endpoints ---');
    // Public register trying to supply role: 'librarian'
    const escalateReg = await post('/api/auth/register', {
      username: 'hacker_user',
      password: 'password123',
      role: 'librarian'
    });
    if (escalateReg.status === 201 && escalateReg.data.user.role === 'member') {
      console.log('  [PASS] POST /api/auth/register forces role: member (client role escalation ignored)');
      passedChecks++;
    } else {
      throw new Error('SECURITY VULNERABILITY: Registration allowed setting non-member role!');
    }

    // Member hitting GET /api/auth/librarians
    const memGetLibs = await get('/api/auth/librarians', mem1Token);
    assertForbidden(memGetLibs, 'Member hitting GET /api/auth/librarians');

    // Member hitting GET /api/auth/users
    const memGetUsers = await get('/api/auth/users', mem1Token);
    assertForbidden(memGetUsers, 'Member hitting GET /api/auth/users');

    console.log('\n--- 2. Testing Item & Catalogue Mutating Endpoints ---');
    // Member hitting POST /api/items (create item)
    const memCreateItem = await post('/api/items', { name: 'Unauthorized Item', category: 'Books' }, mem1Token);
    assertForbidden(memCreateItem, 'Member hitting POST /api/items (create item)');

    // Member hitting POST /api/items/bulk-import (CSV bulk import)
    const memBulkImport = await post('/api/items/bulk-import', { csvData: 'Name,Category\nTest,Test' }, mem1Token);
    assertForbidden(memBulkImport, 'Member hitting POST /api/items/bulk-import');

    // Member hitting GET /api/items/custodian
    const memGetCustItems = await get('/api/items/custodian', mem1Token);
    assertForbidden(memGetCustItems, 'Member hitting GET /api/items/custodian');

    // Member hitting POST /api/items/:id/custodians
    const memAssignCust = await post(`/api/items/${itemA._id}/custodians`, { userId: librarian._id }, mem1Token);
    assertForbidden(memAssignCust, 'Member hitting POST /api/items/:id/custodians');

    // Member hitting DELETE /api/items/:id/custodians/:userId
    const memDeleteCust = await del(`/api/items/${itemA._id}/custodians/${librarian._id}`, mem1Token);
    assertForbidden(memDeleteCust, 'Member hitting DELETE /api/items/:id/custodians/:userId');

    console.log('\n--- 3. Testing Loan Lifecycle & Mutation Endpoints ---');
    // Member hitting PATCH /api/loans/:id/issue
    const memIssueLoan = await patch(`/api/loans/${loan2._id}/issue`, {}, mem1Token);
    assertForbidden(memIssueLoan, 'Member hitting PATCH /api/loans/:id/issue');

    // Member hitting PATCH /api/loans/:id/return
    const memReturnLoan = await patch(`/api/loans/${loan1._id}/return`, {}, mem1Token);
    assertForbidden(memReturnLoan, 'Member hitting PATCH /api/loans/:id/return');

    // Member hitting PATCH /api/loans/:id/lost
    const memLostLoan = await patch(`/api/loans/${loan1._id}/lost`, {}, mem1Token);
    assertForbidden(memLostLoan, 'Member hitting PATCH /api/loans/:id/lost');

    // Member hitting POST /api/loans/bulk-return
    const memBulkReturn = await post('/api/loans/bulk-return', { loanIds: [loan1._id] }, mem1Token);
    assertForbidden(memBulkReturn, 'Member hitting POST /api/loans/bulk-return');

    // Member hitting GET /api/loans/export
    const memExportLoans = await get('/api/loans/export', mem1Token);
    assertForbidden(memExportLoans, 'Member hitting GET /api/loans/export');

    // Member hitting GET /api/loans/overdue
    const memGetOverdue = await get('/api/loans/overdue', mem1Token);
    assertForbidden(memGetOverdue, 'Member hitting GET /api/loans/overdue');

    // Member hitting PATCH /api/loans/:id/dismiss-alert
    const memDismissAlert = await patch(`/api/loans/${loan1._id}/dismiss-alert`, {}, mem1Token);
    assertForbidden(memDismissAlert, 'Member hitting PATCH /api/loans/:id/dismiss-alert');

    console.log('\n--- 4. Testing Multi-Tenant Loan Privacy Isolation ---');
    // Member 1 trying to view Member 2's specific loan (GET /api/loans/:id)
    const mem1ViewMem2Loan = await get(`/api/loans/${loan2._id}`, mem1Token);
    assertForbidden(mem1ViewMem2Loan, 'Member 1 accessing Member 2 loan detail (GET /api/loans/:id)');

    // Member 1 trying to view Member 2's loan timeline (GET /api/loans/:id/timeline)
    const mem1ViewMem2Timeline = await get(`/api/loans/${loan2._id}/timeline`, mem1Token);
    assertForbidden(mem1ViewMem2Timeline, 'Member 1 accessing Member 2 loan timeline (GET /api/loans/:id/timeline)');

    // Member attempting to create loan for someone else or with pre-issued status
    const memCreateFakeIssue = await post('/api/loans', {
      itemId: itemB._id,
      borrowerId: member2._id,
      dueDate: new Date(),
      status: 'Issued'
    }, mem1Token);
    if (memCreateFakeIssue.status === 201) {
      if (memCreateFakeIssue.data.borrower === member1._id.toString() && memCreateFakeIssue.data.status === 'Requested') {
        console.log('  [PASS] Member POST /api/loans forced borrower = self and status = Requested (tamper rejected)');
        passedChecks++;
      } else {
        throw new Error('SECURITY VULNERABILITY: Member was able to set borrowerId or status on loan creation!');
      }
    }

    console.log('\n--- 5. Testing Operations Dashboard Endpoints ---');
    // Member hitting GET /api/dashboard/stats
    const memDashStats = await get('/api/dashboard/stats', mem1Token);
    assertForbidden(memDashStats, 'Member hitting GET /api/dashboard/stats');

    console.log('\n--- 6. Testing Unauthenticated Request Rejection (401) ---');
    const noTokenReq = await get('/api/items');
    if (noTokenReq.status === 401) {
      console.log('  [PASS 401 Unauthorized] Unauthenticated request to /api/items rejected');
      passedChecks++;
    } else {
      throw new Error(`Expected 401 for unauthenticated request, got ${noTokenReq.status}`);
    }

    console.log(`\n====================================================`);
    console.log(`✅ ALL ${passedChecks} ROLE-ENFORCEMENT SECURITY AUDIT CHECKS PASSED!`);
    console.log(`====================================================\n`);
  } finally {
    if (server) server.close();
    await mongoose.connection.close();
    if (mongoServer) await mongoServer.stop();
  }
}

runAudit().catch(err => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});
