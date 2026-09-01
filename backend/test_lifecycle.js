const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('./models/User');
const Item = require('./models/Item');
const Loan = require('./models/Loan');
const LoanHistory = require('./models/LoanHistory');

// Load environment variables
require('dotenv').config();

const PORT = 5005;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let mongoServer;

async function runTests() {
  console.log('--- STARTING LIFECYCLE TESTS ---');

  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  console.log(`MongoDB Memory Server started at ${uri}`);

  // 1. Connect to DB and Clear Data
  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');
  
  await User.deleteMany({});
  await Item.deleteMany({});
  await Loan.deleteMany({});
  await LoanHistory.deleteMany({});
  console.log('Cleared existing collections.');

  // Ensure unique index is built
  await Loan.syncIndexes();
  console.log('Synchronized indexes.');

  // 2. Start Server
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/items', require('./routes/items'));
  app.use('/api/loans', require('./routes/loans'));

  const server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });

  try {
    // Helpers
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
      return { status: res.status, data: await res.json() };
    };

    // --- TEST FLOW ---

    // 1. Register users (seed librarian directly, register member publicly)
    console.log('\n[1] Registering Librarian & Member...');
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
    await User.create({
      username: 'librarian_test',
      password: hashedPassword,
      role: 'librarian'
    });

    const libLogin = await post('/api/auth/login', { username: 'librarian_test', password: 'password123' });
    if (libLogin.status !== 200) throw new Error('Librarian login failed');
    const libToken = libLogin.data.token;

    const memReg = await post('/api/auth/register', { username: 'member_test', password: 'password123' });
    if (memReg.status !== 201) throw new Error('Member registration failed');
    const memToken = memReg.data.token;
    const memberId = memReg.data.user.id;

    // 2. Create an item
    console.log('\n[2] Creating catalog item...');
    const itemCreate = await post('/api/items', { name: 'ThinkPad L14', category: 'Laptops' }, libToken);
    if (itemCreate.status !== 201) throw new Error('Item creation failed');
    const itemId = itemCreate.data._id;
    console.log(`Created item ID: ${itemId}`);

    // 3. Member requests the item
    console.log('\n[3] Member requesting item...');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // 7 days from now
    const loanRequest = await post('/api/loans', { itemId, dueDate }, memToken);
    if (loanRequest.status !== 201) throw new Error(`Loan request failed: ${JSON.stringify(loanRequest.data)}`);
    const loanId = loanRequest.data._id;
    console.log(`Loan request created successfully. Loan ID: ${loanId}, Status: ${loanRequest.data.status}`);
    
    // Verify item is still 'available' in catalog
    const itemAfterReq = (await get('/api/items', libToken)).data.find(i => i._id === itemId);
    if (itemAfterReq.status !== 'available') throw new Error('Item status should be available after request');

    // 4. Double Request Guard Test
    console.log('\n[4] Attempting double-request for same item...');
    const doubleReq = await post('/api/loans', { itemId, dueDate }, memToken);
    if (doubleReq.status !== 400) throw new Error('Double request should be blocked (status 400)');
    console.log(`Double request correctly blocked: ${doubleReq.data.message}`);

    // 5. Issue Loan
    console.log('\n[5] Librarian issuing the requested loan...');
    const loanIssue = await patch(`/api/loans/${loanId}/issue`, {}, libToken);
    if (loanIssue.status !== 200) throw new Error(`Loan issue failed: ${JSON.stringify(loanIssue.data)}`);
    console.log(`Loan issued successfully. Status: ${loanIssue.data.status}`);

    // Verify item status in catalog is now 'borrowed'
    const itemAfterIssue = (await get('/api/items', libToken)).data.find(i => i._id === itemId);
    if (itemAfterIssue.status !== 'borrowed' || itemAfterIssue.borrowedBy !== memberId) {
      throw new Error(`Item catalog update failed: status=${itemAfterIssue.status}, borrowedBy=${itemAfterIssue.borrowedBy}`);
    }
    console.log('Item status correctly updated to borrowed in catalog.');

    // 6. Double Issue Guard Test
    console.log('\n[6] Attempting to direct-issue another loan for the same item...');
    const directIssue = await post('/api/loans', { itemId, borrowerId: memberId, dueDate, status: 'Issued' }, libToken);
    if (directIssue.status !== 400) throw new Error('Double issue should be blocked (status 400)');
    console.log(`Double issue correctly blocked: ${directIssue.data.message}`);

    // 7. Invalid Transition Test (Issued -> Requested)
    console.log('\n[7] Attempting invalid transition: re-issuing an already issued loan...');
    const reIssue = await patch(`/api/loans/${loanId}/issue`, {}, libToken);
    if (reIssue.status !== 400) throw new Error('Re-issue should be blocked (status 400)');
    console.log(`Re-issue correctly blocked: ${reIssue.data.message}`);

    // 8. Return Loan
    console.log('\n[8] Returning the loan...');
    const loanReturn = await patch(`/api/loans/${loanId}/return`, {}, libToken);
    if (loanReturn.status !== 200) throw new Error(`Loan return failed: ${JSON.stringify(loanReturn.data)}`);
    console.log(`Loan returned successfully. Status: ${loanReturn.data.loan.status}`);

    // Verify item is available again
    const itemAfterReturn = (await get('/api/items', libToken)).data.find(i => i._id === itemId);
    if (itemAfterReturn.status !== 'available' || itemAfterReturn.borrowedBy !== null) {
      throw new Error('Item status should be available and borrowedBy null after return');
    }
    console.log('Item catalog reset to available.');

    // Verify LoanHistory timeline entries exist
    const histories = await LoanHistory.find({ item: itemId }).sort({ createdAt: 1 });
    if (histories.length !== 3) {
      throw new Error(`Loan history entries count incorrect: expected 3, got ${histories.length}`);
    }
    if (histories[0].state !== 'Requested' || histories[1].state !== 'Issued' || histories[2].state !== 'Returned') {
      throw new Error(`Loan history states incorrect: ${JSON.stringify(histories)}`);
    }
    console.log('LoanHistory timeline audit entries created successfully.');

    // 9. Edge Case: Returning already-returned loan
    console.log('\n[9] Attempting to return already-returned loan...');
    const doubleReturn = await patch(`/api/loans/${loanId}/return`, {}, libToken);
    if (doubleReturn.status !== 400) throw new Error('Double return should fail (status 400)');
    console.log(`Double return correctly blocked: ${doubleReturn.data.message}`);

    // 10. Edge Case: Marking returned loan lost
    console.log('\n[10] Attempting to mark returned loan as lost...');
    const markLostReturned = await patch(`/api/loans/${loanId}/lost`, {}, libToken);
    if (markLostReturned.status !== 400) throw new Error('Marking returned loan lost should fail (status 400)');
    console.log(`Marking returned loan lost correctly blocked: ${markLostReturned.data.message}`);

    // 11. Direct-Issue and Mark Lost flow
    console.log('\n[11] Librarian direct-issuing a new loan...');
    const directLoan = await post('/api/loans', { itemId, borrowerId: memberId, dueDate, status: 'Issued' }, libToken);
    if (directLoan.status !== 201) throw new Error(`Direct issue failed: ${JSON.stringify(directLoan.data)}`);
    const directLoanId = directLoan.data._id;
    console.log(`Direct loan created with status: ${directLoan.data.status}`);

    const itemAfterDirect = (await get('/api/items', libToken)).data.find(i => i._id === itemId);
    if (itemAfterDirect.status !== 'borrowed') throw new Error('Item status should be borrowed after direct issue');

    console.log('\n[12] Marking direct loan as lost...');
    const markLost = await patch(`/api/loans/${directLoanId}/lost`, {}, libToken);
    if (markLost.status !== 200) throw new Error(`Mark lost failed: ${JSON.stringify(markLost.data)}`);
    console.log(`Loan marked lost successfully. Status: ${markLost.data.status}`);

    // Verify item is marked lost
    const itemAfterLost = (await get('/api/items', libToken)).data.find(i => i._id === itemId);
    if (itemAfterLost.status !== 'lost') throw new Error('Item status should be lost after marking loan lost');
    console.log('Item status correctly updated to lost in catalog.');

    // 12. Edge Case: marking lost again
    console.log('\n[13] Attempting to mark lost loan as lost again...');
    const doubleLost = await patch(`/api/loans/${directLoanId}/lost`, {}, libToken);
    if (doubleLost.status !== 400) throw new Error('Double lost should fail (status 400)');
    console.log(`Double lost correctly blocked: ${doubleLost.data.message}`);

    // ==========================================
    // DAY 4: SEARCH, FILTER, SORT, PAGINATION & ROLE SCOPING TESTS
    // ==========================================
    console.log('\n--- DAY 4: TESTING SEARCH, FILTERS, SORTING, PAGINATION & ROLE ENFORCEMENT ---');

    // [14] Seed extra users, items, and loans for multi-loan querying
    console.log('\n[14] Seeding additional data for query tests...');
    const mem2Reg = await post('/api/auth/register', { username: 'alice_researcher', password: 'password123' });
    const mem2Token = mem2Reg.data.token;
    const mem2Id = mem2Reg.data.user.id;

    const mem3Reg = await post('/api/auth/register', { username: 'bob_student', password: 'password123' });
    const mem3Token = mem3Reg.data.token;
    const mem3Id = mem3Reg.data.user.id;

    const item2Res = await post('/api/items', { name: 'MacBook Pro 16', category: 'Laptops' }, libToken);
    const item2Id = item2Res.data._id;

    const item3Res = await post('/api/items', { name: 'Dell XPS 15', category: 'Laptops' }, libToken);
    const item3Id = item3Res.data._id;

    const item4Res = await post('/api/items', { name: 'Sony Camera A7', category: 'Cameras' }, libToken);
    const item4Id = item4Res.data._id;

    // Create several loans across users
    const d1 = new Date(); d1.setDate(d1.getDate() + 2); // 2 days
    const d2 = new Date(); d2.setDate(d2.getDate() + 10); // 10 days
    const d3 = new Date(); d3.setDate(d3.getDate() + 5); // 5 days

    const loanA = await post('/api/loans', { itemId: item2Id, borrowerId: mem2Id, dueDate: d1, status: 'Issued' }, libToken);
    const loanB = await post('/api/loans', { itemId: item3Id, dueDate: d2 }, mem3Token); // Requested
    const loanC = await post('/api/loans', { itemId: item4Id, borrowerId: mem3Id, dueDate: d3, status: 'Issued' }, libToken);

    console.log('Seeded additional test data.');

    // [15] Test text search (by item title and borrower username)
    console.log('\n[15] Testing text search...');
    const searchItem = await get('/api/loans?search=MacBook', libToken);
    if (searchItem.status !== 200 || searchItem.data.loans.length !== 1 || searchItem.data.loans[0].item.name !== 'MacBook Pro 16') {
      throw new Error(`Text search by item title failed: ${JSON.stringify(searchItem.data)}`);
    }
    console.log('Search by item title passed.');

    const searchBorrower = await get('/api/loans?search=alice', libToken);
    if (searchBorrower.status !== 200 || searchBorrower.data.loans.length !== 1 || searchBorrower.data.loans[0].borrower.username !== 'alice_researcher') {
      throw new Error(`Text search by borrower username failed: ${JSON.stringify(searchBorrower.data)}`);
    }
    console.log('Search by borrower username passed.');

    // [16] Test filters (status, item, borrower)
    console.log('\n[16] Testing filters (status, item, borrower)...');
    const filterStatusReq = await get('/api/loans?status=Requested', libToken);
    if (filterStatusReq.status !== 200 || !filterStatusReq.data.loans.every(l => l.status === 'Requested')) {
      throw new Error(`Status filter failed: ${JSON.stringify(filterStatusReq.data)}`);
    }
    console.log(`Status filter passed (found ${filterStatusReq.data.loans.length} requested loans).`);

    const filterItem = await get(`/api/loans?item=${item2Id}`, libToken);
    if (filterItem.status !== 200 || filterItem.data.loans.length !== 1 || filterItem.data.loans[0].item._id !== item2Id) {
      throw new Error(`Item filter failed: ${JSON.stringify(filterItem.data)}`);
    }
    console.log('Item filter passed.');

    const filterBorrower = await get(`/api/loans?borrower=${mem3Id}`, libToken);
    if (filterBorrower.status !== 200 || filterBorrower.data.loans.length !== 2 || !filterBorrower.data.loans.every(l => l.borrower._id === mem3Id)) {
      throw new Error(`Borrower filter failed: ${JSON.stringify(filterBorrower.data)}`);
    }
    console.log('Borrower filter passed.');

    // [17] Test sorting (dueDate asc/desc, createdAt)
    console.log('\n[17] Testing sorting...');
    const sortDueDateAsc = await get('/api/loans?sortBy=dueDate&sortOrder=asc', libToken);
    const dueDates = sortDueDateAsc.data.loans.map(l => new Date(l.dueDate).getTime());
    for (let i = 1; i < dueDates.length; i++) {
      if (dueDates[i] < dueDates[i - 1]) throw new Error(`Due date asc sort failed: ${dueDates}`);
    }
    console.log('Sorting by dueDate ASC passed.');

    const sortDueDateDesc = await get('/api/loans?sortBy=dueDate&sortOrder=desc', libToken);
    const dueDatesDesc = sortDueDateDesc.data.loans.map(l => new Date(l.dueDate).getTime());
    for (let i = 1; i < dueDatesDesc.length; i++) {
      if (dueDatesDesc[i] > dueDatesDesc[i - 1]) throw new Error(`Due date DESC sort failed: ${dueDatesDesc}`);
    }
    console.log('Sorting by dueDate DESC passed.');

    // [18] Test pagination (limit, page, totalCount, totalPages)
    console.log('\n[18] Testing pagination...');
    const page1 = await get('/api/loans?page=1&limit=2', libToken);
    if (page1.status !== 200 || page1.data.loans.length !== 2 || page1.data.page !== 1 || page1.data.limit !== 2) {
      throw new Error(`Pagination page 1 failed: ${JSON.stringify(page1.data)}`);
    }
    if (page1.data.totalCount < 4 || page1.data.totalPages < 2) {
      throw new Error(`Pagination total count/pages incorrect: ${JSON.stringify(page1.data)}`);
    }

    const page2 = await get('/api/loans?page=2&limit=2', libToken);
    if (page2.status !== 200 || page2.data.loans.length !== 2 || page2.data.page !== 2) {
      throw new Error(`Pagination page 2 failed: ${JSON.stringify(page2.data)}`);
    }
    if (page1.data.loans[0]._id === page2.data.loans[0]._id) {
      throw new Error('Page 1 and Page 2 contain duplicate elements');
    }
    console.log(`Pagination passed: Total ${page1.data.totalCount} loans across ${page1.data.totalPages} pages.`);

    // [19] Role Enforcement: Member scope security test
    console.log('\n[19] Testing role enforcement for member loans...');
    // Member should only see their own loans
    const memLoans = await get('/api/loans', memToken);
    if (memLoans.status !== 200) throw new Error('Member get loans failed');
    if (!memLoans.data.loans.every(l => l.borrower._id === memberId)) {
      throw new Error(`Security breach: Member received loans of other users! ${JSON.stringify(memLoans.data)}`);
    }
    console.log('Member query automatically scoped to own ID.');

    // Member trying to pass borrower query param for another user
    const breachAttempt = await get(`/api/loans?borrower=${mem2Id}`, memToken);
    if (breachAttempt.status !== 200) throw new Error('Query with borrower param failed');
    if (breachAttempt.data.loans.some(l => l.borrower._id === mem2Id)) {
      throw new Error('Security breach: Member bypassed role scoping using ?borrower query param!');
    }
    if (!breachAttempt.data.loans.every(l => l.borrower._id === memberId)) {
      throw new Error('Security breach: Member query returned unauthorized loans');
    }
    console.log('Member query parameter tamper blocked: scope strictly preserved.');

    // Member searching for another member's name
    const searchOtherMem = await get('/api/loans?search=alice', memToken);
    if (searchOtherMem.data.loans.length !== 0) {
      throw new Error('Security breach: Member found other member loans via search!');
    }
    console.log('Member text search correctly confined to own loans.');

    // [20] Test GET /api/auth/users endpoint authorization
    console.log('\n[20] Testing /api/auth/users role authorization...');
    const usersAsLib = await get('/api/auth/users', libToken);
    if (usersAsLib.status !== 200 || usersAsLib.data.length < 3) {
      throw new Error('Librarian should be able to fetch users list');
    }
    const usersAsMem = await get('/api/auth/users', memToken);
    if (usersAsMem.status !== 403) {
      throw new Error('Member should be forbidden from accessing /api/auth/users');
    }
    console.log('User listing correctly protected to librarians only.');

    console.log('\n--- ALL LIFECYCLE & DAY 4 SEARCH/PAGINATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n!!! TEST FAILURE !!!');
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
      console.log('MongoDB Memory Server stopped.');
    }
    console.log('Server and DB connection closed.');
    process.exit(process.exitCode || 0);
  }
}

runTests();
