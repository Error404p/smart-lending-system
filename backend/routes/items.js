const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/items
// @desc    Create a new catalog item
// @access  Private (Librarian only)
router.post('/', protect, authorize('librarian'), async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name || !category) {
      return res.status(400).json({ message: 'Name and category are required' });
    }

    const newItem = new Item({
      name,
      category
    });

    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/items/custodian
// @desc    Get all catalog items personally custodianed by the logged-in librarian
// @access  Private (Librarian only)
router.get('/custodian', protect, authorize('librarian'), async (req, res) => {
  try {
    const items = await Item.find({ custodians: req.user.id });
    res.json(items);
  } catch (err) {
    console.error('Get custodian items error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/items
// @desc    Get all catalog items
// @access  Private (Authenticated users)
router.get('/', protect, async (req, res) => {
  try {
    const items = await Item.find({}).populate('custodians', 'username role');
    res.json(items);
  } catch (err) {
    console.error('Get items error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/items/:id/custodians
// @desc    Assign a librarian as a custodian for an item
// @access  Private (Librarian only)
router.post('/:id/custodians', protect, authorize('librarian'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Check if target user exists and is a librarian
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (targetUser.role !== 'librarian') {
      return res.status(400).json({ message: 'Only librarians can be assigned as custodians' });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Add to custodians if not already present
    if (!item.custodians.includes(userId)) {
      item.custodians.push(userId);
      await item.save();
    }

    res.json(item);
  } catch (err) {
    console.error('Assign custodian error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/items/:id/custodians/:userId
// @desc    Remove a librarian from custodians of an item
// @access  Private (Librarian only)
router.delete('/:id/custodians/:userId', protect, authorize('librarian'), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Remove from custodians
    item.custodians = item.custodians.filter(c => c.toString() !== req.params.userId);
    await item.save();

    res.json(item);
  } catch (err) {
    console.error('Remove custodian error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
