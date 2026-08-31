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

    console.log('\n--- ALL LIFECYCLE TESTS PASSED SUCCESSFULLY! ---');
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
