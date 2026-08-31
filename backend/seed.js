require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Item = require('./models/Item');
const Loan = require('./models/Loan');
const LoanHistory = require('./models/LoanHistory');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-lending';

async function seedDB() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to database.');

    // Clear existing data
    console.log('Clearing existing database collections...');
    await User.deleteMany({});
    await Item.deleteMany({});
    await Loan.deleteMany({});
    await LoanHistory.deleteMany({});
    console.log('Cleared database.');

    // Sync Loan indexes (e.g. partial unique index)
    await Loan.syncIndexes();
    console.log('Synchronized indexes.');

    // Hashing passwords
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    // Create users
    console.log('Creating users...');
    const librarian = await User.create({
      username: 'librarian',
      password: passwordHash,
      role: 'librarian'
    });

    const member1 = await User.create({
      username: 'member1',
      password: passwordHash,
      role: 'member'
    });

    const member2 = await User.create({
      username: 'member2',
      password: passwordHash,
      role: 'member'
    });

    const member3 = await User.create({
      username: 'member3',
      password: passwordHash,
      role: 'member'
    });
    console.log('Users created successfully.');

    // Create catalogue items
    console.log('Creating items...');
    const itemLaptop = await Item.create({
      name: 'MacBook Pro 16"',
      category: 'Laptops',
      status: 'borrowed',
      borrowedBy: member1._id
    });

    const itemBook = await Item.create({
      name: 'Introduction to Algorithms',
      category: 'Books',
      status: 'available',
      borrowedBy: null
    });

    const itemTablet = await Item.create({
      name: 'iPad Air 5th Gen',
      category: 'Tablets',
      status: 'borrowed',
      borrowedBy: member2._id
    });

    const itemProjector = await Item.create({
      name: 'Epson Projector 1080p',
      category: 'Equipment',
      status: 'available',
      borrowedBy: null
    });
    console.log('Items created successfully.');

    // Create loans
    console.log('Creating loans...');
    
    // 1. Requested loan (member2 requesting 'Introduction to Algorithms')
    const loanRequested = await Loan.create({
      item: itemBook._id,
      borrower: member2._id,
      borrowDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
      status: 'Requested'
    });

    // 2. Issued loan (member1 checkout 'MacBook Pro')
    const loanIssued = await Loan.create({
      item: itemLaptop._id,
      borrower: member1._id,
      borrowDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
      status: 'Issued'
    });

    // 3. Issued and overdue loan (member2 checkout 'iPad Air', overdue)
    const loanOverdue = await Loan.create({
      item: itemTablet._id,
      borrower: member2._id,
      borrowDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (in past!)
      status: 'Issued'
    });

    // 4. Returned loan (member3 returned 'Epson Projector')
    const loanReturned = await Loan.create({
      item: itemProjector._id,
      borrower: member3._id,
      borrowDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      status: 'Returned',
      returnedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });

    // Since this is returned, also write a dummy audit entry in LoanHistory for now
    await LoanHistory.create({
      item: itemProjector._id,
      borrower: member3._id,
      borrowDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      returnDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      statusAtReturn: 'returned'
    });

    console.log('Loans created successfully.');
    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

seedDB();
