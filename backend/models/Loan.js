const mongoose = require('mongoose');

const LoanSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  borrower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  borrowDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'returned', 'overdue'],
    default: 'active',
    required: true
  },
  returnedDate: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Loan', LoanSchema);
