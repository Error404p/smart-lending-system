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
    enum: ['Requested', 'Issued', 'Returned', 'Lost'],
    default: 'Requested',
    required: true
  },
  returnedDate: {
    type: Date
  },
  alertDismissed: {
    type: Boolean,
    default: false,
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for dynamic overdue status calculation
LoanSchema.virtual('isOverdue').get(function() {
  return this.status === 'Issued' && this.dueDate < new Date();
});

// Partial unique index to enforce that an item can only have ONE open loan (Requested or Issued) at a time
LoanSchema.index(
  { item: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['Requested', 'Issued'] } }
  }
);

module.exports = mongoose.model('Loan', LoanSchema);
