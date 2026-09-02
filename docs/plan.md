# Project Plan & Session Tracking

This document outlines the paced 6-day build schedule (2h per session), work breakdown, build order, and estimates vs. actuals.

## Session Breakdown & Progress

| Day | Focus Scope | Est. Time | Actual Time | Status | Git Commits Summary |
| --- | --- | --- | --- | --- | --- |
| **Day 1** | Project scaffold, Mongoose schemas, Auth JWT & Role Middlewares, Base CRUD | 2.0h | ~1.8h | Completed | `4e709fe` - `ece2396` |
| **Day 2** | Loan Lifecycle State Machine, Concurrency checkout guard, In-memory tests | 2.0h | ~2.0h | Completed | `9983e7a` - `6320991` |
| **Day 3** | Custodians, Append-only Loan Timelines, Overdue Alert Computation & Scoped Dismissal, React UI | 2.0h | ~2.1h | Completed | `d59b5f5` - `9698308` |
| **Day 4** | Server-side Search, Multi-criteria Filters, Sorting & Skip/Limit Pagination with Total Match Counts | 2.0h | ~1.9h | Completed | `eb5bf04` - `a4a7979` |
| **Day 5** | Bulk CSV Import with per-row reports, Bulk Return with per-loan reports, Active Loans CSV Export, Dashboard with Headline stats & 8-week Chart.js return trends | 2.0h | ~2.0h | Completed | `1585199`, `e2583a6`, `de62da4`, `1f8aec3`, `89331de` |
| **Day 6** | Multi-role demo seed data, Deployment configuration (Render + Vercel + MongoDB Atlas), `SUBMISSION.md`, Final review | 2.0h | - | Planned (Next Session) | - |

---

## Day 5 Build Order & Design Rationale
1. **CSV Bulk Import**: Built with a native in-memory parser to isolate invalid rows and return a per-row error report while importing all valid assets.
2. **Bulk Return**: Built to process an array of loan IDs, verifying that each is currently in `Issued` status, returning individual success/rejection reports and resetting item availability.
3. **CSV Export**: Created an export endpoint streaming all active `Issued` loans in standard CSV format with headers, borrower info, and overdue indicators.
4. **Dashboard Backend & Aggregations**: Implemented `GET /api/dashboard/stats` aggregating headline numbers, lifecycle status counts, librarian custodian item/loan counts, and 8 distinct rolling 7-day return volume buckets.
5. **Frontend Dashboard & Bulk Action UI**: Added Dashboard tab with 4 metric cards, status breakdown cards, custodian distribution table, and an 8-week return trends bar chart using Chart.js on a native `<canvas>`. Added CSV importer modal and bulk return selection controls.
