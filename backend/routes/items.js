const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// Helper to parse CSV lines safely handling quotes and commas
function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' || char === "'") {
      if (inQuotes && text[i + 1] === char) {
        cur += char;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

// @route   POST /api/items/bulk-import
// @desc    Bulk import catalogue items from CSV text
// @access  Private (Librarian only)
router.post('/bulk-import', protect, authorize('librarian'), async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData || typeof csvData !== 'string' || !csvData.trim()) {
      return res.status(400).json({ message: 'CSV data string is required in request body' });
    }

    const lines = csvData
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length < 2) {
      return res.status(400).json({ message: 'CSV must contain at least a header line and one data row' });
    }

    // Parse header
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    let nameIdx = headers.findIndex(h => ['name', 'title', 'item', 'item name', 'item_name'].includes(h));
    let catIdx = headers.findIndex(h => ['category', 'cat', 'item_category', 'item category'].includes(h));

    // Fallback if headers are not named standardly but exactly 2 columns are present
    if (nameIdx === -1 && catIdx === -1 && headers.length >= 2) {
      nameIdx = 0;
      catIdx = 1;
    } else {
      if (nameIdx === -1) nameIdx = 0;
      if (catIdx === -1) catIdx = 1;
    }

    const imported = [];
    const failed = [];

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1; // 1-indexed for human readability
      const rawLine = lines[i];
      const cols = parseCSVLine(rawLine);

      const name = cols[nameIdx] || '';
      const category = cols[catIdx] || '';

      if (!name) {
        failed.push({
          row: rowNum,
          raw: rawLine,
          reason: 'Missing required field: item name / title'
        });
        continue;
      }

      if (!category) {
        failed.push({
          row: rowNum,
          raw: rawLine,
          reason: 'Missing required field: category'
        });
        continue;
      }

      try {
        const newItem = new Item({
          name: name.trim(),
          category: category.trim(),
          status: 'available'
        });
        await newItem.save();
        imported.push({
          row: rowNum,
          item: {
            id: newItem._id,
            name: newItem.name,
            category: newItem.category
          }
        });
      } catch (saveErr) {
        failed.push({
          row: rowNum,
          raw: rawLine,
          reason: saveErr.message || 'Database error creating item'
        });
      }
    }

    res.status(200).json({
      totalRows: lines.length - 1,
      importedCount: imported.length,
      failedCount: failed.length,
      imported,
      failed
    });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ message: 'Server error processing CSV bulk import' });
  }
});

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
