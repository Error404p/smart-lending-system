const mongoose = require('mongoose');

const LoanHistorySchema = new mongoose.Schema({
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
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  returnDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  statusAtReturn: {
    type: String,
    enum: ['returned', 'returned-overdue'],
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LoanHistory', LoanHistorySchema);
