const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
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

// @route   GET /api/items
// @desc    Get all catalog items
// @access  Private (Authenticated users)
router.get('/', protect, async (req, res) => {
  try {
    const items = await Item.find({});
    res.json(items);
  } catch (err) {
    console.error('Get items error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
