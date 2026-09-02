const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const Loan = require('../models/Loan');
const Item = require('../models/Item');
const User = require('../models/User');
const LoanHistory = require('../models/LoanHistory');
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/loans/bulk-return
// @desc    Bulk return multiple issued loans in one action
// @access  Private (Librarian only)
router.post('/bulk-return', protect, authorize('librarian'), async (req, res) => {
  try {
    const { loanIds, note } = req.body;
    if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
      return res.status(400).json({ message: 'loanIds array is required' });
    }

    const results = [];
    let successCount = 0;
    let rejectedCount = 0;

    for (const id of loanIds) {
      if (!mongoose.isValidObjectId(id)) {
        results.push({
          loanId: id,
          status: 'rejected',
          reason: 'Invalid loan ID format'
        });
        rejectedCount++;
        continue;
      }

      const loan = await Loan.findById(id);
      if (!loan) {
        results.push({
          loanId: id,
          status: 'rejected',
          reason: 'Loan not found'
        });
        rejectedCount++;
        continue;
      }

      if (loan.status !== 'Issued') {
        results.push({
          loanId: id,
          status: 'rejected',
          reason: `Cannot return loan in '${loan.status}' status (must be in 'Issued' status)`
        });
        rejectedCount++;
        continue;
      }

      // Process return
      loan.status = 'Returned';
      loan.returnedDate = new Date();
      await loan.save();

      // Reset item in catalogue
      await Item.findByIdAndUpdate(loan.item, {
        status: 'available',
        borrowedBy: null
      });

      // Write timeline audit record
      const returnHistory = new LoanHistory({
        loan: loan._id,
        item: loan.item,
        borrower: loan.borrower,
        state: 'Returned',
        changedBy: req.user.id,
        note: note ? `Bulk return: ${note}` : 'Bulk return action'
      });
      await returnHistory.save();

      results.push({
        loanId: id,
        status: 'success',
        message: 'Loan successfully returned'
      });
      successCount++;
    }

    res.json({
      total: loanIds.length,
      successCount,
      rejectedCount,
      results
    });
  } catch (err) {
    console.error('Bulk return error:', err);
    res.status(500).json({ message: 'Server error processing bulk return' });
  }
});

// @route   GET /api/loans/export
// @desc    Export every item currently on loan as a CSV
// @access  Private (Librarian only)
router.get('/export', protect, authorize('librarian'), async (req, res) => {
  try {
    const activeLoans = await Loan.find({ status: 'Issued' })
      .populate('item')
      .populate('borrower', 'username role')
      .sort({ dueDate: 1 });

    const headers = ['Item Name', 'Category', 'Borrower', 'Borrow Date', 'Due Date', 'Overdue'];
    const rows = [headers.join(',')];

    for (const loan of activeLoans) {
      const itemName = loan.item ? `"${(loan.item.name || '').replace(/"/g, '""')}"` : 'Unknown Item';
      const category = loan.item ? `"${(loan.item.category || '').replace(/"/g, '""')}"` : '';
      const borrower = loan.borrower ? `"${(loan.borrower.username || '').replace(/"/g, '""')}"` : 'Unknown';
      const borrowDate = loan.borrowDate ? new Date(loan.borrowDate).toISOString().split('T')[0] : '';
      const dueDate = loan.dueDate ? new Date(loan.dueDate).toISOString().split('T')[0] : '';
      const isOverdue = loan.dueDate && new Date(loan.dueDate) < new Date() ? 'Yes' : 'No';

      rows.push([itemName, category, borrower, borrowDate, dueDate, isOverdue].join(','));
    }

    const csvContent = rows.join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="active-loans-${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export loans error:', err);
    res.status(500).json({ message: 'Server error generating loans CSV export' });
  }
});

// @route   POST /api/loans
// @desc    Create a new loan (member request or librarian direct-issue)
// @access  Private (Authenticated users)
router.post('/', protect, async (req, res) => {
  try {
    const { itemId, borrowerId, dueDate, status } = req.body;

    // Validate input
    if (!itemId || !dueDate) {
      return res.status(400).json({ message: 'Item ID and due date are required' });
    }

    // Determine target borrower
    let targetBorrowerId = req.user.id;
    if (req.user.role === 'librarian' && borrowerId) {
      targetBorrowerId = borrowerId;
    }

    // Determine target status
    let targetStatus = 'Requested';
    if (req.user.role === 'librarian' && status) {
      if (!['Requested', 'Issued'].includes(status)) {
        return res.status(400).json({ message: "Initial status must be either 'Requested' or 'Issued'" });
      }
      targetStatus = status;
    }

    // Verify item exists
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Verify borrower exists
    const borrower = await User.findById(targetBorrowerId);
    if (!borrower) {
      return res.status(404).json({ message: 'Borrower not found' });
    }

    // Server-side guard: Reject if the item already has an open loan (Requested or Issued)
    const existingOpenLoan = await Loan.findOne({
      item: itemId,
      status: { $in: ['Requested', 'Issued'] }
    });
    if (existingOpenLoan) {
      return res.status(400).json({
        message: `Refused: Item already has an open loan. Existing loan status is '${existingOpenLoan.status}'.`
      });
    }

    // Create loan object
    const newLoan = new Loan({
      item: itemId,
      borrower: targetBorrowerId,
      dueDate: new Date(dueDate),
      status: targetStatus
    });

    if (targetStatus === 'Issued') {
      newLoan.borrowDate = new Date();
    }

    // Save loan, catching duplicate key errors from the partial unique index (concurrency guard)
    try {
      await newLoan.save();
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          message: 'Concurrency Guard: A concurrent request or issue was detected. The item already has an open loan.'
        });
      }
      throw err;
    }

    // Write initial state to timeline
    const initialHistory = new LoanHistory({
      loan: newLoan._id,
      item: itemId,
      borrower: targetBorrowerId,
      state: targetStatus,
      changedBy: req.user.id,
      note: req.body.note || ''
    });
    await initialHistory.save();

    // If direct-issued, update item state
    if (targetStatus === 'Issued') {
      await Item.findByIdAndUpdate(itemId, {
        status: 'borrowed',
        borrowedBy: targetBorrowerId
      });
    }

    res.status(201).json(newLoan);
  } catch (err) {
    console.error('Create loan error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/loans/:id/issue
// @desc    Issue a requested loan
// @access  Private (Librarian only)
router.patch('/:id/issue', protect, authorize('librarian'), async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Strict transition check: Requested -> Issued
    if (loan.status !== 'Requested') {
      return res.status(400).json({
        message: `Invalid transition: Cannot issue a loan in '${loan.status}' status. It must be in 'Requested' status.`
      });
    }

    // Double-check if there is another open loan for this item (concurrency safety)
    const otherOpenLoan = await Loan.findOne({
      item: loan.item,
      status: { $in: ['Requested', 'Issued'] },
      _id: { $ne: loan._id }
    });
    if (otherOpenLoan) {
      return res.status(400).json({
        message: `Refused: Item already has an active loan. Existing loan status is '${otherOpenLoan.status}'.`
      });
    }

    // Update loan details
    loan.status = 'Issued';
    loan.borrowDate = new Date();
    if (req.body.dueDate) {
      loan.dueDate = new Date(req.body.dueDate);
    }

    try {
      await loan.save();
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          message: 'Concurrency Guard: A concurrent issue operation was detected. The item already has an open loan.'
        });
      }
      throw err;
    }

    // Write state change to timeline
    const issueHistory = new LoanHistory({
      loan: loan._id,
      item: loan.item,
      borrower: loan.borrower,
      state: 'Issued',
      changedBy: req.user.id,
      note: req.body.note || ''
    });
    await issueHistory.save();

    // Update item catalogue state
    await Item.findByIdAndUpdate(loan.item, {
      status: 'borrowed',
      borrowedBy: loan.borrower
    });

    res.json(loan);
  } catch (err) {
    console.error('Issue loan error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/loans/:id/return
// @desc    Return an issued item
// @access  Private (Librarian only)
router.patch('/:id/return', protect, authorize('librarian'), async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Strict transition check: Issued -> Returned
    if (loan.status !== 'Issued') {
      return res.status(400).json({
        message: `Invalid transition: Cannot return a loan in '${loan.status}' status. It must be in 'Issued' status.`
      });
    }

    // Update loan state
    loan.status = 'Returned';
    loan.returnedDate = new Date();
    await loan.save();

    // Reset item status to available
    await Item.findByIdAndUpdate(loan.item, {
      status: 'available',
      borrowedBy: null
    });

    // Write state change to timeline
    const returnHistory = new LoanHistory({
      loan: loan._id,
      item: loan.item,
      borrower: loan.borrower,
      state: 'Returned',
      changedBy: req.user.id,
      note: req.body.note || ''
    });
    await returnHistory.save();

    res.json({ loan, history: returnHistory });
  } catch (err) {
    console.error('Return loan error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/loans/:id/lost
// @desc    Mark an issued item as lost
// @access  Private (Librarian only)
router.patch('/:id/lost', protect, authorize('librarian'), async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Strict transition check: Issued -> Lost
    if (loan.status !== 'Issued') {
      return res.status(400).json({
        message: `Invalid transition: Cannot mark a loan in '${loan.status}' status as lost. It must be in 'Issued' status.`
      });
    }

    // Update loan state
    loan.status = 'Lost';
    await loan.save();

    // Mark item as lost in catalog
    await Item.findByIdAndUpdate(loan.item, {
      status: 'lost',
      borrowedBy: null
    });

    // Write state change to timeline
    const lostHistory = new LoanHistory({
      loan: loan._id,
      item: loan.item,
      borrower: loan.borrower,
      state: 'Lost',
      changedBy: req.user.id,
      note: req.body.note || ''
    });
    await lostHistory.save();

    res.json(loan);
  } catch (err) {
    console.error('Mark lost error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/loans
// @desc    Get loans with server-side text search, filters, and sorting
// @access  Private (Librarians view all, Members scoped to their own loans)
router.get('/', protect, async (req, res) => {
  try {
    const { search, status, item, borrower, sortBy, sortOrder } = req.query;

    const queryConditions = [];

    // Role Enforcement: Members MUST only ever see their own loans
    if (req.user.role !== 'librarian') {
      queryConditions.push({ borrower: req.user.id });
    } else if (borrower && mongoose.isValidObjectId(borrower)) {
      queryConditions.push({ borrower });
    }

    // Status filter
    if (status && ['Requested', 'Issued', 'Returned', 'Lost'].includes(status)) {
      queryConditions.push({ status });
    }

    // Item filter
    if (item && mongoose.isValidObjectId(item)) {
      queryConditions.push({ item });
    }

    // Text search over item title (name) and borrower (username)
    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitized, 'i');

      const [matchingItems, matchingUsers] = await Promise.all([
        Item.find({ name: searchRegex }).select('_id'),
        User.find({ username: searchRegex }).select('_id')
      ]);

      const itemIds = matchingItems.map(i => i._id);
      const userIds = matchingUsers.map(u => u._id);

      queryConditions.push({
        $or: [
          { item: { $in: itemIds } },
          { borrower: { $in: userIds } }
        ]
      });
    }

    const finalQuery = queryConditions.length > 0 ? { $and: queryConditions } : {};

    // Sorting
    const sortFieldMap = {
      dueDate: 'dueDate',
      createdAt: 'createdAt',
      requestedDate: 'createdAt',
      borrowDate: 'borrowDate',
      status: 'status'
    };
    const sortField = sortFieldMap[sortBy] || 'createdAt';
    const direction = (sortOrder === 'asc' || sortOrder === '1') ? 1 : -1;
    const sortOptions = { [sortField]: direction };

    // Pagination
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [totalCount, loans] = await Promise.all([
      Loan.countDocuments(finalQuery),
      Loan.find(finalQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate('item')
        .populate('borrower', 'username role')
    ]);

    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    res.json({
      loans,
      totalCount,
      totalPages,
      page: pageNum,
      limit: limitNum
    });
  } catch (err) {
    console.error('Get loans error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/loans/overdue
// @desc    Get all active overdue loans (librarian only)
// @access  Private (Librarian only)
router.get('/overdue', protect, authorize('librarian'), async (req, res) => {
  try {
    const overdueLoans = await Loan.find({
      status: 'Issued',
      dueDate: { $lt: new Date() },
      alertDismissed: { $ne: true }
    })
    .populate('item')
    .populate('borrower', 'username role');

    res.json(overdueLoans);
  } catch (err) {
    console.error('Get overdue loans error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/loans/:id/dismiss-alert
// @desc    Dismiss overdue alert for a specific loan (librarian only)
// @access  Private (Librarian only)
router.patch('/:id/dismiss-alert', protect, authorize('librarian'), async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (loan.status !== 'Issued') {
      return res.status(400).json({ message: 'Only active issued loans can have overdue alerts dismissed' });
    }

    loan.alertDismissed = true;
    await loan.save();

    res.json({ message: 'Alert dismissed successfully', loan });
  } catch (err) {
    console.error('Dismiss alert error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/loans/:id
// @desc    Get a single loan details
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('item')
      .populate('borrower', 'username role');

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Members can only view their own loan
    if (req.user.role !== 'librarian' && loan.borrower._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this loan' });
    }

    res.json(loan);
  } catch (err) {
    console.error('Get loan by id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/loans/:id/timeline
// @desc    Get the timeline history of a loan
// @access  Private
router.get('/:id/timeline', protect, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Enforce authorization: Members can only see their own loan's timeline
    if (req.user.role !== 'librarian' && loan.borrower.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this timeline' });
    }

    const timeline = await LoanHistory.find({ loan: req.params.id })
      .sort({ createdAt: 1 })
      .populate('changedBy', 'username role');

    res.json(timeline);
  } catch (err) {
    console.error('Get timeline error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
