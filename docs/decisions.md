# Architecture & Tech Decisions Log

This document records the architectural calls, trade-offs, and design revisions made across all 6 development sessions of the Asset Lending System.

---

# Day 1 Decisions

## 1. Git Repository Re-initialization
The starter workspace contained detached commits and files missing from the working tree. To ensure clean, human-paced, reproducible Git history, the existing `.git` directory was re-initialized fresh.

## 2. Using `bcryptjs` over native `bcrypt`
Native C++ `bcrypt` frequently fails compilation across varied developer environments (Windows build tools, minimal CI/CD containers). `bcryptjs` provides pure-JavaScript hashing with zero binary dependencies, ensuring portability with negligible latency for authentication workloads.

## 3. Database Separation of Active Loans and History [REVERSED on Day 3]
*Initial Decision*: Keep active loans in `loans` collection and move closed loans to `loanhistories`.
*Status*: **REVERSED on Day 3 (See Decision #10)**.

## 4. Auth Flow & JWT Payload
The `/register` and `/login` endpoints return the signed JWT token along with sanitized user details (`id`, `username`, `role`) so the client does not need a secondary network roundtrip to initialize user session state.

---

# Day 2 Decisions

## 5. Concurrency Guard via MongoDB Partial Unique Index
To prevent race conditions where two simultaneous checkouts or requests for the same catalogue item slip through, we implemented a MongoDB Partial Unique Index on `Loan` `{ item: 1 }` filtered by `{ status: { $in: ['Requested', 'Issued'] } }`. This acts as an atomic database-level enforcement mechanism that rejects duplicate active loans without requiring MongoDB multi-document transactions or replica-set configurations.

## 6. In-Memory Automated Testing Harness
To enable fast, hermetic, offline test runs without relying on a pre-installed host MongoDB service, we integrated `mongodb-memory-server` into `test_lifecycle.js`. It boots an ephemeral in-memory database, runs test assertions, and tears down cleanly.

---

# Day 3 Decisions

## 7. Persistent In-Memory Database for Local Development (`start-db.js`)
Since no background MongoDB daemon was running on the development workstation, we configured `start-db.js` with `mongodb-memory-server` bound to port 27017 writing data physically to `backend/db-data`. This provides a zero-install developer experience with full persistence across restarts.

## 8. Hardcoded Role Isolation on Public Registration
Audited `POST /api/auth/register` to unconditionally enforce `role: 'member'`, ignoring any `role` attribute passed in client request bodies. Librarian accounts can only be provisioned via direct database seeding or administrative scripts, eliminating client privilege escalation.

## 9. Scoping Overdue Alerts to Loan Instances
To ensure that dismissing an alert for an overdue loan does not suppress alerts if the item is borrowed again in the future, we attached `alertDismissed` to the specific `Loan` document rather than the `Item` or `User`. Future loans for the same asset generate distinct alerts when overdue.

## 10. REVERSAL OF DECISION #3: Unified Loan Collection & Append-Only Timeline Events
*Reversal Context*: Moving loans between `loans` and `loanhistories` caused schema duplication, complex pagination across two collections, and loss of intermediate transition audit metadata.
*New Design*: All loan records (`Requested`, `Issued`, `Returned`, `Lost`) reside in the single `loans` collection. `LoanHistory` was repurposed as an append-only timeline event log (recording `{ loan, item, borrower, state, changedBy, note, timestamp }`). This enables historical audit trails while keeping active and past queries unified.

---

# Day 4 Decisions

## 11. Server-Side Search via Relational ID Resolution
Instead of fetching entire datasets into client memory, `GET /api/loans` resolves search queries against `Item` (name) and `User` (username) collections via regex, passing matching IDs to an `$or` query on the `loans` collection.

## 12. Unconditional Database-Level Tenant Scoping
Member loan queries are hard-scoped on the server via `finalQuery.borrower = req.user.id`. Any `borrower` filter supplied in the query string by a member is discarded before query execution, preventing cross-tenant information disclosure.

## 13. Skip/Limit Pagination with Concurrent Count Queries
Sorting and pagination (`skip`, `limit`) execute directly in the database. `Loan.countDocuments()` runs in parallel with `Loan.find()` using `Promise.all`, returning total matching records and total page count without full-table data transfer.

---

# Day 5 Decisions

## 14. In-Memory Streaming CSV Parser vs Heavy External Libraries
For `POST /api/items/bulk-import`, we wrote a lightweight native RFC-compliant CSV parser handling quoted cells and commas. This avoided heavy dependencies like `papaparse` while generating granular line-by-line validation failure reports with exact row indices and rejection reasons.

## 15. Individual Loan Isolation in Bulk Actions
Both CSV bulk import and bulk return avoid all-or-nothing transactions. Valid rows and loans are processed and committed immediately, while invalid items are captured in a structured failure report (`{ total, successCount, rejectedCount, results }`).

## 16. Canvas-Ref Chart.js Integration without React Wrappers
Integrated `chart.js` directly on a native HTML5 `<canvas>` ref via `useEffect` lifecycle rather than using wrappers (`react-chartjs-2`). This guarantees zero React 19 compatibility hurdles and clean teardown on tab unmounts.

## 17. Rolling 8-Week Time Window Computation
The backend computes 8 distinct 7-day intervals counting backwards from `Date.now()`, executing `Loan.countDocuments({ status: 'Returned', returnedDate: { $gte: weekStart, $lt: weekEnd } })` for each window. This ensures uniform 8-point metrics even on fresh databases.

---

# Day 6 Decisions

## 18. Deterministic Multi-Period Demo Data Generation
Rather than seeding arbitrary dummy records, `seed.js` generates realistic multi-role personas (3 librarians, 5 members), 17 catalogue items across 7 categories, and 26 loans with full `LoanHistory` event timelines. Returned loans are deliberately distributed across all 8 weekly return intervals so that the Operations Dashboard returns trend chart immediately showcases rich operational insights.

## 19. Single-Source Environment-Aware API Client Configuration
In `frontend/src/App.jsx`, `API_BASE` dynamically resolves `import.meta.env.VITE_API_URL` with automatic `/api` suffix normalization, falling back cleanly to `http://127.0.0.1:5000/api` in local development. This enables seamless deployment to Vercel without altering codebase source files.

## 20. Declarative Cloud Infrastructure Blueprints (`render.yaml` & `vercel.json`)
Created blueprint configuration files for Render (`render.yaml`) and Vercel (`vercel.json`). `render.yaml` specifies root directories, build/start commands, health check paths, and required environment variables, while `vercel.json` provides SPA rewrite rules (`/(.*)` -> `/`) to ensure client-side routing functions correctly under production CDN hosting.

## 21. Automated Self-Contained Role-Enforcement Security Audit Suite (`test_audit.js`)
Built a standalone test suite (`backend/test_audit.js`) using `MongoMemoryServer` that authenticates as both `librarian` and `member` users and tests all 19 mutating and privileged endpoints. It asserts HTTP 403 Forbidden for unauthorized access, HTTP 401 for unauthenticated requests, and blocks member role escalation and query tampering.
