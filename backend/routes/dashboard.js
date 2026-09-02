const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const Loan = require('../models/Loan');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard metrics, breakdown by status & custodian, and 8-week return trends
// @access  Private (Librarian only)
router.get('/stats', protect, authorize('librarian'), async (req, res) => {
  try {
    const now = new Date();

    // 1. Headline Numbers
    // Start of current week (7 days ago or start of week)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalCatalogueItems,
      itemsOut,
      itemsOverdue,
      loansReturnedThisWeek,
      allStatusCounts,
      librarians
    ] = await Promise.all([
      Item.countDocuments({}),
      Loan.countDocuments({ status: 'Issued' }),
      Loan.countDocuments({ status: 'Issued', dueDate: { $lt: now } }),
      Loan.countDocuments({ status: 'Returned', returnedDate: { $gte: sevenDaysAgo } }),
      Loan.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      User.find({ role: 'librarian' }).select('username')
    ]);

    // Format status breakdown with defaults for all 4 states
    const statusBreakdown = {
      Requested: 0,
      Issued: 0,
      Returned: 0,
      Lost: 0
    };
    allStatusCounts.forEach(entry => {
      if (statusBreakdown.hasOwnProperty(entry._id)) {
        statusBreakdown[entry._id] = entry.count;
      }
    });

    // 2. Custodian Breakdown
    const custodianBreakdown = [];
    for (const lib of librarians) {
      // Find items custodianed by this librarian
      const custodianItems = await Item.find({ custodians: lib._id }).select('_id');
      const itemIds = custodianItems.map(i => i._id);

      // Count active (Issued) loans on those items
      const activeLoansCount = await Loan.countDocuments({
        item: { $in: itemIds },
        status: 'Issued'
      });

      // Count total loans ever on those items
      const totalLoansCount = await Loan.countDocuments({
        item: { $in: itemIds }
      });

      custodianBreakdown.push({
        librarianId: lib._id,
        username: lib.username,
        itemCount: itemIds.length,
        activeLoansCount,
        totalLoansCount
      });
    }

    // 3. Weekly Returns over the last 8 weeks
    // Build 8 weekly intervals
    const weeklyReturns = [];
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    for (let i = 7; i >= 0; i--) {
      const weekEnd = new Date(now.getTime() - i * oneWeekMs);
      const weekStart = new Date(weekEnd.getTime() - oneWeekMs);

      const returnedInWeek = await Loan.countDocuments({
        status: 'Returned',
        returnedDate: {
          $gte: weekStart,
          $lt: weekEnd
        }
      });

      const startMonth = weekStart.toLocaleString('default', { month: 'short' });
      const startDay = weekStart.getDate();
      const endMonth = weekEnd.toLocaleString('default', { month: 'short' });
      const endDay = weekEnd.getDate();

      const label = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;

      weeklyReturns.push({
        weekIndex: 8 - i,
        label,
        count: returnedInWeek
      });
    }

    res.json({
      headlines: {
        itemsOut,
        itemsOverdue,
        loansReturnedThisWeek,
        totalCatalogueItems
      },
      statusBreakdown,
      custodianBreakdown,
      weeklyReturns
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Server error generating dashboard statistics' });
  }
});

module.exports = router;
