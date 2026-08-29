const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['member', 'librarian'],
    default: 'member',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
