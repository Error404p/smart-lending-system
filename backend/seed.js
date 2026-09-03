require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
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
    console.log('Synchronized collection indexes.');

    // Common password hash
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    // 1. Create Librarians & Members
    console.log('Creating demo users across multiple roles...');
    
    // Librarians
    const librarianLead = await User.create({
      username: 'librarian',
      password: passwordHash,
      role: 'librarian'
    });

    const librarianBob = await User.create({
      username: 'librarian_bob',
      password: passwordHash,
      role: 'librarian'
    });

    const librarianCarol = await User.create({
      username: 'librarian_carol',
      password: passwordHash,
      role: 'librarian'
    });

    // Members
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

    const member4 = await User.create({
      username: 'member4',
      password: passwordHash,
      role: 'member'
    });

    const member5 = await User.create({
      username: 'member5',
      password: passwordHash,
      role: 'member'
    });

    console.log('✔ Created 3 Librarians and 5 Members.');

    // 2. Create Catalogue Items (17 items across 7 categories)
    console.log('Creating catalogue items...');
    
    // Laptops
    const itemMacBook = await Item.create({
      name: 'MacBook Pro 16" M3 Max',
      category: 'Laptops',
      status: 'borrowed',
      borrowedBy: member1._id,
      custodians: [librarianLead._id, librarianCarol._id]
    });

    const itemDellXps = await Item.create({
      name: 'Dell XPS 15 9530 OLED',
      category: 'Laptops',
      status: 'borrowed',
      borrowedBy: member4._id,
      custodians: [librarianCarol._id]
    });

    const itemThinkPad = await Item.create({
      name: 'ThinkPad X1 Carbon Gen 11',
      category: 'Laptops',
      status: 'available',
      borrowedBy: null,
      custodians: [librarianCarol._id]
    });

    // Cameras
    const itemSonyA7 = await Item.create({
      name: 'Sony Alpha A7 IV Kit',
      category: 'Cameras',
      status: 'borrowed',
      borrowedBy: member3._id,
      custodians: [librarianBob._id]
    });

    const itemCanonR6 = await Item.create({
      name: 'Canon EOS R6 Mark II',
      category: 'Cameras',
      status: 'available',
      borrowedBy: null,
      custodians: [librarianBob._id, librarianLead._id]
    });

    const itemBmpcc = await Item.create({
      name: 'Blackmagic Pocket Cinema 6K',
      category: 'Cameras',
      status: 'borrowed',
      borrowedBy: member2._id,
      custodians: [librarianBob._id]
    });

    // Audio
    const itemShureMic = await Item.create({
      name: 'Shure SM7B Dynamic Mic',
      category: 'Audio',
      status: 'borrowed',
      borrowedBy: member1._id,
      custodians: [librarianBob._id]
    });

    const itemRodeMic = await Item.create({
      name: 'Rode Wireless PRO Lavalier Kit',
      category: 'Audio',
      status: 'available',
      borrowedBy: null,
      custodians: [librarianBob._id]
    });

    const itemSonyHeadphones = await Item.create({
      name: 'Sony WH-1000XM5 ANC Headphones',
      category: 'Audio',
      status: 'available',
      borrowedBy: null,
      custodians: []
    });

    // Tablets
    const itemIpadPro = await Item.create({
      name: 'iPad Pro 12.9" M2',
      category: 'Tablets',
      status: 'borrowed',
      borrowedBy: member2._id,
      custodians: [librarianLead._id]
    });

    const itemWacomTablet = await Item.create({
      name: 'Wacom Cintiq 16 Pen Display',
      category: 'Tablets',
      status: 'available',
      borrowedBy: null,
      custodians: [librarianCarol._id]
    });

    // VR & Drones
    const itemQuest3 = await Item.create({
      name: 'Meta Quest 3 512GB VR Headset',
      category: 'VR & Drones',
      status: 'borrowed',
      borrowedBy: member5._id,
      custodians: [librarianCarol._id]
    });

    const itemDjiDrone = await Item.create({
      name: 'DJI Mini 4 Pro Fly More Combo',
      category: 'VR & Drones',
      status: 'lost',
      borrowedBy: null,
      custodians: [librarianBob._id]
    });

    // Equipment & Monitors
    const itemProjector = await Item.create({
      name: 'Epson PowerLite 1080p Projector',
      category: 'Equipment',
      status: 'available',
      borrowedBy: null,
      custodians: [librarianLead._id]
    });

    const itemDellMonitor = await Item.create({
      name: 'Dell UltraSharp 27" 4K Monitor',
      category: 'Equipment',
      status: 'borrowed',
      borrowedBy: member4._id,
      custodians: []
    });

    // Books
    const itemDdiaBook = await Item.create({
      name: 'Designing Data-Intensive Applications',
      category: 'Books',
      status: 'available',
      borrowedBy: null,
      custodians: [librarianLead._id]
    });

    const itemCleanArchBook = await Item.create({
      name: 'Clean Architecture: A Craftsman Guide',
      category: 'Books',
      status: 'available',
      borrowedBy: null,
      custodians: [librarianLead._id]
    });

    console.log('✔ Created 17 catalogue items.');

    // Helper to create loan and corresponding timeline entries
    console.log('Creating loans and append-only audit histories...');
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    // 1. Requested Loans
    const reqLoan1 = await Loan.create({
      item: itemThinkPad._id,
      borrower: member3._id,
      borrowDate: new Date(now - 1 * DAY),
      dueDate: new Date(now + 6 * DAY),
      status: 'Requested'
    });
    await LoanHistory.create({
      loan: reqLoan1._id,
      item: itemThinkPad._id,
      borrower: member3._id,
      state: 'Requested',
      changedBy: member3._id,
      note: 'Requested for upcoming hackathon weekend.',
      createdAt: new Date(now - 1 * DAY)
    });

    const reqLoan2 = await Loan.create({
      item: itemCleanArchBook._id,
      borrower: member5._id,
      borrowDate: new Date(now - 2 * DAY),
      dueDate: new Date(now + 12 * DAY),
      status: 'Requested'
    });
    await LoanHistory.create({
      loan: reqLoan2._id,
      item: itemCleanArchBook._id,
      borrower: member5._id,
      state: 'Requested',
      changedBy: member5._id,
      note: 'Requested for software engineering term research.',
      createdAt: new Date(now - 2 * DAY)
    });

    const reqLoan3 = await Loan.create({
      item: itemWacomTablet._id,
      borrower: member2._id,
      borrowDate: new Date(now - 0.5 * DAY),
      dueDate: new Date(now + 7 * DAY),
      status: 'Requested'
    });
    await LoanHistory.create({
      loan: reqLoan3._id,
      item: itemWacomTablet._id,
      borrower: member2._id,
      state: 'Requested',
      changedBy: member2._id,
      note: 'Requested for digital illustration assignment.',
      createdAt: new Date(now - 0.5 * DAY)
    });

    // 2. Active Issued Loans (On Schedule)
    const issLoan1 = await Loan.create({
      item: itemMacBook._id,
      borrower: member1._id,
      borrowDate: new Date(now - 3 * DAY),
      dueDate: new Date(now + 4 * DAY),
      status: 'Issued'
    });
    await LoanHistory.create({
      loan: issLoan1._id,
      item: itemMacBook._id,
      borrower: member1._id,
      state: 'Requested',
      changedBy: member1._id,
      note: 'Needed for final year project compute.',
      createdAt: new Date(now - 4 * DAY)
    });
    await LoanHistory.create({
      loan: issLoan1._id,
      item: itemMacBook._id,
      borrower: member1._id,
      state: 'Issued',
      changedBy: librarianLead._id,
      note: 'Device verified, battery health 100%, handed over with 140W charger.',
      createdAt: new Date(now - 3 * DAY)
    });

    const issLoan2 = await Loan.create({
      item: itemSonyA7._id,
      borrower: member3._id,
      borrowDate: new Date(now - 2 * DAY),
      dueDate: new Date(now + 5 * DAY),
      status: 'Issued'
    });
    await LoanHistory.create({
      loan: issLoan2._id,
      item: itemSonyA7._id,
      borrower: member3._id,
      state: 'Requested',
      changedBy: member3._id,
      note: 'Requested for campus documentary shoot.',
      createdAt: new Date(now - 3 * DAY)
    });
    await LoanHistory.create({
      loan: issLoan2._id,
      item: itemSonyA7._id,
      borrower: member3._id,
      state: 'Issued',
      changedBy: librarianBob._id,
      note: 'Issued with 28-70mm lens, 2x batteries, and 128GB SD card.',
      createdAt: new Date(now - 2 * DAY)
    });

    const issLoan3 = await Loan.create({
      item: itemDellXps._id,
      borrower: member4._id,
      borrowDate: new Date(now - 1 * DAY),
      dueDate: new Date(now + 13 * DAY),
      status: 'Issued'
    });
    await LoanHistory.create({
      loan: issLoan3._id,
      item: itemDellXps._id,
      borrower: member4._id,
      state: 'Requested',
      changedBy: member4._id,
      note: 'Machine learning model training workload.',
      createdAt: new Date(now - 2 * DAY)
    });
    await LoanHistory.create({
      loan: issLoan3._id,
      item: itemDellXps._id,
      borrower: member4._id,
      state: 'Issued',
      changedBy: librarianCarol._id,
      note: 'Issued and tested with Ubuntu dual-boot setup.',
      createdAt: new Date(now - 1 * DAY)
    });

    const issLoan4 = await Loan.create({
      item: itemQuest3._id,
      borrower: member5._id,
      borrowDate: new Date(now - 2 * DAY),
      dueDate: new Date(now + 8 * DAY),
      status: 'Issued'
    });
    await LoanHistory.create({
      loan: issLoan4._id,
      item: itemQuest3._id,
      borrower: member5._id,
      state: 'Requested',
      changedBy: member5._id,
      note: 'VR Spatial UI research experimentation.',
      createdAt: new Date(now - 3 * DAY)
    });
    await LoanHistory.create({
      loan: issLoan4._id,
      item: itemQuest3._id,
      borrower: member5._id,
      state: 'Issued',
      changedBy: librarianCarol._id,
      note: 'Sanitized, updated to latest firmware, controllers paired.',
      createdAt: new Date(now - 2 * DAY)
    });

    const issLoan5 = await Loan.create({
      item: itemDellMonitor._id,
      borrower: member4._id,
      borrowDate: new Date(now - 4 * DAY),
      dueDate: new Date(now + 10 * DAY),
      status: 'Issued'
    });
    await LoanHistory.create({
      loan: issLoan5._id,
      item: itemDellMonitor._id,
      borrower: member4._id,
      state: 'Requested',
      changedBy: member4._id,
      note: 'Secondary display for data analysis workstation.',
      createdAt: new Date(now - 5 * DAY)
    });
    await LoanHistory.create({
      loan: issLoan5._id,
      item: itemDellMonitor._id,
      borrower: member4._id,
      state: 'Issued',
      changedBy: librarianLead._id,
      note: 'Issued with DisplayPort & HDMI cables.',
      createdAt: new Date(now - 4 * DAY)
    });

    // 3. Active Issued Loans (Overdue)
    // 3a. Overdue by 3 days (Active alert)
    const ovrLoan1 = await Loan.create({
      item: itemIpadPro._id,
      borrower: member2._id,
      borrowDate: new Date(now - 10 * DAY),
      dueDate: new Date(now - 3 * DAY),
      status: 'Issued',
      alertDismissed: false
    });
    await LoanHistory.create({
      loan: ovrLoan1._id,
      item: itemIpadPro._id,
      borrower: member2._id,
      state: 'Requested',
      changedBy: member2._id,
      note: 'Initial request for UI/UX sketches.',
      createdAt: new Date(now - 11 * DAY)
    });
    await LoanHistory.create({
      loan: ovrLoan1._id,
      item: itemIpadPro._id,
      borrower: member2._id,
      state: 'Issued',
      changedBy: librarianLead._id,
      note: 'Issued with Apple Pencil 2nd Gen.',
      createdAt: new Date(now - 10 * DAY)
    });

    // 3b. Overdue by 6 days (Active alert)
    const ovrLoan2 = await Loan.create({
      item: itemBmpcc._id,
      borrower: member2._id,
      borrowDate: new Date(now - 14 * DAY),
      dueDate: new Date(now - 6 * DAY),
      status: 'Issued',
      alertDismissed: false
    });
    await LoanHistory.create({
      loan: ovrLoan2._id,
      item: itemBmpcc._id,
      borrower: member2._id,
      state: 'Requested',
      changedBy: member2._id,
      note: 'Short film production.',
      createdAt: new Date(now - 15 * DAY)
    });
    await LoanHistory.create({
      loan: ovrLoan2._id,
      item: itemBmpcc._id,
      borrower: member2._id,
      state: 'Issued',
      changedBy: librarianBob._id,
      note: 'Issued with cage, V-mount battery, and Samsung T5 SSD.',
      createdAt: new Date(now - 14 * DAY)
    });

    // 3c. Overdue by 8 days (Alert Dismissed by Librarian)
    const ovrLoan3 = await Loan.create({
      item: itemShureMic._id,
      borrower: member1._id,
      borrowDate: new Date(now - 18 * DAY),
      dueDate: new Date(now - 8 * DAY),
      status: 'Issued',
      alertDismissed: true // Librarian acknowledged extension note
    });
    await LoanHistory.create({
      loan: ovrLoan3._id,
      item: itemShureMic._id,
      borrower: member1._id,
      state: 'Requested',
      changedBy: member1._id,
      note: 'Podcast series recording.',
      createdAt: new Date(now - 19 * DAY)
    });
    await LoanHistory.create({
      loan: ovrLoan3._id,
      item: itemShureMic._id,
      borrower: member1._id,
      state: 'Issued',
      changedBy: librarianBob._id,
      note: 'Issued with Cloudlifter CL-1 preamp.',
      createdAt: new Date(now - 18 * DAY)
    });

    // 4. Lost Item & Loan
    const lostLoan = await Loan.create({
      item: itemDjiDrone._id,
      borrower: member3._id,
      borrowDate: new Date(now - 25 * DAY),
      dueDate: new Date(now - 15 * DAY),
      status: 'Lost'
    });
    await LoanHistory.create({
      loan: lostLoan._id,
      item: itemDjiDrone._id,
      borrower: member3._id,
      state: 'Requested',
      changedBy: member3._id,
      note: 'Aerial photography fieldwork.',
      createdAt: new Date(now - 26 * DAY)
    });
    await LoanHistory.create({
      loan: lostLoan._id,
      item: itemDjiDrone._id,
      borrower: member3._id,
      state: 'Issued',
      changedBy: librarianBob._id,
      note: 'Issued with RC 2 controller and 3 batteries.',
      createdAt: new Date(now - 25 * DAY)
    });
    await LoanHistory.create({
      loan: lostLoan._id,
      item: itemDjiDrone._id,
      borrower: member3._id,
      state: 'Lost',
      changedBy: librarianLead._id,
      note: 'Reported lost during storm over reservoir. Incident report #2026-08 filed for institutional insurance.',
      createdAt: new Date(now - 16 * DAY)
    });

    // 5. Historical Returned Loans across 8 Weekly Buckets (for Dashboard Trend Chart)
    // Week 1 (0 to 7 days ago)
    const retW1a = await Loan.create({
      item: itemProjector._id,
      borrower: member3._id,
      borrowDate: new Date(now - 6 * DAY),
      dueDate: new Date(now - 2 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 2 * DAY)
    });
    await LoanHistory.create({
      loan: retW1a._id, item: itemProjector._id, borrower: member3._id,
      state: 'Returned', changedBy: librarianLead._id, note: 'Returned in clean working order.',
      createdAt: new Date(now - 2 * DAY)
    });

    const retW1b = await Loan.create({
      item: itemCanonR6._id,
      borrower: member1._id,
      borrowDate: new Date(now - 5 * DAY),
      dueDate: new Date(now - 1 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 1 * DAY)
    });
    await LoanHistory.create({
      loan: retW1b._id, item: itemCanonR6._id, borrower: member1._id,
      state: 'Returned', changedBy: librarianBob._id, note: 'Returned with all accessories intact.',
      createdAt: new Date(now - 1 * DAY)
    });

    // Week 2 (7 to 14 days ago)
    const retW2a = await Loan.create({
      item: itemRodeMic._id,
      borrower: member5._id,
      borrowDate: new Date(now - 13 * DAY),
      dueDate: new Date(now - 8 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 9 * DAY)
    });
    await LoanHistory.create({
      loan: retW2a._id, item: itemRodeMic._id, borrower: member5._id,
      state: 'Returned', changedBy: librarianBob._id, note: 'Returned on schedule.',
      createdAt: new Date(now - 9 * DAY)
    });

    const retW2b = await Loan.create({
      item: itemDdiaBook._id,
      borrower: member4._id,
      borrowDate: new Date(now - 15 * DAY),
      dueDate: new Date(now - 10 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 11 * DAY)
    });
    await LoanHistory.create({
      loan: retW2b._id, item: itemDdiaBook._id, borrower: member4._id,
      state: 'Returned', changedBy: librarianLead._id, note: 'Returned to bookshelf.',
      createdAt: new Date(now - 11 * DAY)
    });

    // Week 3 (14 to 21 days ago)
    const retW3a = await Loan.create({
      item: itemSonyHeadphones._id,
      borrower: member2._id,
      borrowDate: new Date(now - 20 * DAY),
      dueDate: new Date(now - 16 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 17 * DAY)
    });
    await LoanHistory.create({
      loan: retW3a._id, item: itemSonyHeadphones._id, borrower: member2._id,
      state: 'Returned', changedBy: librarianLead._id, note: 'Returned, tested audio channels.',
      createdAt: new Date(now - 17 * DAY)
    });

    // Week 4 (21 to 28 days ago)
    const retW4a = await Loan.create({
      item: itemThinkPad._id,
      borrower: member1._id,
      borrowDate: new Date(now - 27 * DAY),
      dueDate: new Date(now - 22 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 23 * DAY)
    });
    await LoanHistory.create({
      loan: retW4a._id, item: itemThinkPad._id, borrower: member1._id,
      state: 'Returned', changedBy: librarianCarol._id, note: 'Returned in excellent condition.',
      createdAt: new Date(now - 23 * DAY)
    });

    const retW4b = await Loan.create({
      item: itemProjector._id,
      borrower: member4._id,
      borrowDate: new Date(now - 26 * DAY),
      dueDate: new Date(now - 24 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 25 * DAY)
    });
    await LoanHistory.create({
      loan: retW4b._id, item: itemProjector._id, borrower: member4._id,
      state: 'Returned', changedBy: librarianLead._id, note: 'Auditorium screening return.',
      createdAt: new Date(now - 25 * DAY)
    });

    // Week 5 (28 to 35 days ago)
    const retW5a = await Loan.create({
      item: itemCanonR6._id,
      borrower: member3._id,
      borrowDate: new Date(now - 34 * DAY),
      dueDate: new Date(now - 30 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 31 * DAY)
    });
    await LoanHistory.create({
      loan: retW5a._id, item: itemCanonR6._id, borrower: member3._id,
      state: 'Returned', changedBy: librarianBob._id, note: 'Returned after photo exhibition.',
      createdAt: new Date(now - 31 * DAY)
    });

    const retW5b = await Loan.create({
      item: itemWacomTablet._id,
      borrower: member2._id,
      borrowDate: new Date(now - 33 * DAY),
      dueDate: new Date(now - 29 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 30 * DAY)
    });
    await LoanHistory.create({
      loan: retW5b._id, item: itemWacomTablet._id, borrower: member2._id,
      state: 'Returned', changedBy: librarianCarol._id, note: 'Display screen inspected, no scratches.',
      createdAt: new Date(now - 30 * DAY)
    });

    const retW5c = await Loan.create({
      item: itemCleanArchBook._id,
      borrower: member1._id,
      borrowDate: new Date(now - 35 * DAY),
      dueDate: new Date(now - 31 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 32 * DAY)
    });
    await LoanHistory.create({
      loan: retW5c._id, item: itemCleanArchBook._id, borrower: member1._id,
      state: 'Returned', changedBy: librarianLead._id, note: 'Book returned on time.',
      createdAt: new Date(now - 32 * DAY)
    });

    // Week 6 (35 to 42 days ago)
    const retW6a = await Loan.create({
      item: itemMacBook._id,
      borrower: member5._id,
      borrowDate: new Date(now - 41 * DAY),
      dueDate: new Date(now - 36 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 37 * DAY)
    });
    await LoanHistory.create({
      loan: retW6a._id, item: itemMacBook._id, borrower: member5._id,
      state: 'Returned', changedBy: librarianLead._id, note: 'Clean OS wipe and return.',
      createdAt: new Date(now - 37 * DAY)
    });

    const retW6b = await Loan.create({
      item: itemShureMic._id,
      borrower: member3._id,
      borrowDate: new Date(now - 40 * DAY),
      dueDate: new Date(now - 37 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 38 * DAY)
    });
    await LoanHistory.create({
      loan: retW6b._id, item: itemShureMic._id, borrower: member3._id,
      state: 'Returned', changedBy: librarianBob._id, note: 'Voiceover session completed.',
      createdAt: new Date(now - 38 * DAY)
    });

    // Week 7 (42 to 49 days ago)
    const retW7a = await Loan.create({
      item: itemDellXps._id,
      borrower: member1._id,
      borrowDate: new Date(now - 48 * DAY),
      dueDate: new Date(now - 44 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 45 * DAY)
    });
    await LoanHistory.create({
      loan: retW7a._id, item: itemDellXps._id, borrower: member1._id,
      state: 'Returned', changedBy: librarianCarol._id, note: 'Returned after semester exams.',
      createdAt: new Date(now - 45 * DAY)
    });

    // Week 8 (49 to 56 days ago)
    const retW8a = await Loan.create({
      item: itemSonyA7._id,
      borrower: member4._id,
      borrowDate: new Date(now - 55 * DAY),
      dueDate: new Date(now - 50 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 51 * DAY)
    });
    await LoanHistory.create({
      loan: retW8a._id, item: itemSonyA7._id, borrower: member4._id,
      state: 'Returned', changedBy: librarianBob._id, note: 'Returned in good working order.',
      createdAt: new Date(now - 51 * DAY)
    });

    const retW8b = await Loan.create({
      item: itemProjector._id,
      borrower: member2._id,
      borrowDate: new Date(now - 54 * DAY),
      dueDate: new Date(now - 51 * DAY),
      status: 'Returned',
      returnedDate: new Date(now - 52 * DAY)
    });
    await LoanHistory.create({
      loan: retW8b._id, item: itemProjector._id, borrower: member2._id,
      state: 'Returned', changedBy: librarianLead._id, note: 'Seminar presentation return.',
      createdAt: new Date(now - 52 * DAY)
    });

    console.log('✔ Created 26 loans with full history timelines spanning all 8 weekly return buckets.');
    console.log('\n======================================================');
    console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
    console.log('Librarian Accounts:');
    console.log('  - librarian / password123 (Lead Librarian Alice)');
    console.log('  - librarian_bob / password123 (AV & Media Custodian)');
    console.log('  - librarian_carol / password123 (Hardware Custodian)');
    console.log('\nMember Accounts:');
    console.log('  - member1 / password123 (Alex Turner)');
    console.log('  - member2 / password123 (Charlie Brown)');
    console.log('  - member3 / password123 (Diana Prince)');
    console.log('  - member4 / password123 (Evan Wright)');
    console.log('  - member5 / password123 (Fiona Gallagher)');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

seedDB();
