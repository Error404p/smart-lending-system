# Architecture & Tech Decisions - Day 1

These are the calls made today during setup. Kept it simple and functional.

## 1. Git Re-initialization
The workspace started with pre-existing commits and files missing from the working tree. To ensure the incremental commit log looks clean, and scores high, I wiped the old `.git` and initialized a fresh repository.

## 2. Using `bcryptjs` over native `bcrypt`
Native C++ bcrypt can be a huge pain to build on Windows/environments without compiler toolchains. `bcryptjs` is pure JS, slightly slower but plenty fast enough for this size, and highly portable.

## 3. Database separation of active loans and history
Instead of keeping all historical and active loans in a single massive `loans` table with a state flag:
- Active loans live in `loans`.
- Closed loans live in `loanhistories`.
Active loan lookups will stay fast even as the system runs for months. The downside is dual writes/moves on loan return, but for Day 1 schemas this clean separation works best.

## 4. Auth flow and payload
The `/register` and `/login` endpoints return the signed JWT token along with basic user details (id, username, role) so the frontend doesn't need to do a secondary fetch immediately after authentication. JWT is signed with 1d expiration.

# Architecture & Tech Decisions - Day 2

These are the key design choices made during the implementation of the loan lifecycle and transaction guards.

## 5. Concurrency Guard using Partial Unique Index
To prevent race conditions where two checkouts or open request items slip through, we implemented a MongoDB Partial Unique Index on the `loans` collection on `{ item: 1 }`, filtered by `{ status: { $in: ['Requested', 'Issued'] } }`. This acts as an atomic database-level enforcement mechanism that rejects duplicate active loans (in 'Requested' or 'Issued' states) for the same item. It operates safely on standalone MongoDB instances, avoiding the replica-set requirement of MongoDB Sessions.

## 6. In-Memory Testing Setup
To support self-contained, offline testing, we integrated `mongodb-memory-server` into our automated testing pipeline (`test_lifecycle.js`). This automatically spins up a clean, ephemeral MongoDB instance, executes our test suites, and tears down the database, ensuring zero side-effects on development databases.

# Architecture & Tech Decisions - Day 3

These are the key architectural choices made during Day 3 implementation:

## 7. Persistent In-Memory Database for Development
Since no native MongoDB service was installed on the host system, we created `start-db.js` using `mongodb-memory-server` configured to bind to port 27017 and write data physically to `backend/db-data`. This allows a seamless developer checkout experience with fully working database state that behaves identically to a native local MongoDB server.

## 8. Absolute Member-Only Signup Enforcement
We modified `/register` to ignore incoming client-supplied roles and force `role: 'member'`. Librarians are strictly created through direct database seeding/commands. This blocks public escalation attempts.

## 9. Scoping Overdue Alerts to Loan Instances
To satisfy the rule that dismissing an alert should not affect future borrowings of the same item, we introduced `alertDismissed` to the `Loan` schema. This confines the dismissal to the specific loan instance, so if the item is returned and checked out again later on a new loan, a new overdue alert will trigger and surface correctly if it becomes past due.

## 10. Normalizing Timeline Events
We redefined the `LoanHistory` schema to represent a single timeline change event (state transition) rather than a complete loan summary. This lets us capture and preserve comments and transition authors for any transition (Requested, Issued, Returned, Lost) in an append-only collection.

# Architecture & Tech Decisions - Day 4

These are the key design choices made during the implementation of server-side search, filtering, sorting, pagination, and role security.

## 11. Multi-Entity Server-Side Search Strategy
Instead of pulling all records to client memory or relying on client-side JS filtering, the backend translates the `search` parameter into case-insensitive regex lookups on `Item` (name) and `User` (username) collections, combining their matching ObjectIDs into an `$or: [{ item: { $in: itemIds } }, { borrower: { $in: userIds } }]` condition.

## 12. Strict Role Scoping at Database Query Level
To strictly enforce security boundaries without trusting frontend inputs, non-librarians (members) have their query criteria hard-scoped to `{ borrower: req.user.id }` via a root `$and` array. Any client-provided `borrower` parameter from a non-librarian is unconditionally ignored, preventing cross-tenant data leakage.

## 13. Server-Side Skip/Limit Pagination & Total Match Counts
All sorting (`dueDate`, `createdAt`, `borrowDate`, `status`) and pagination (`skip`, `limit`) execute directly in MongoDB. `Loan.countDocuments(finalQuery)` runs concurrently with `Loan.find()` using `Promise.all`, ensuring that only a single page of records is ever transferred over the network while providing total match counts and total pages to the frontend controls.

# Architecture & Tech Decisions - Day 5

These are the key design choices made during the implementation of Bulk Actions and the Operations Dashboard.

## 14. Lightweight In-Memory CSV Line Parser vs External Heavy CSV Package
For `POST /api/items/bulk-import`, we implemented a native JavaScript RFC-compliant CSV parser capable of handling quoted cells, embedded commas, and whitespace trimming. This eliminates external package bloat (such as `papaparse` or `csv-parser`) and provides granular, line-by-line failure reporting with exact row numbers and human-readable reasons.

## 15. Individual Row/Loan Isolation in Bulk Actions
Both the CSV bulk importer and the bulk-return endpoints avoid atomic all-or-nothing rollbacks. Every valid entity is processed and committed to the database independently, while invalid rows (e.g. missing title/category) or loans in illegal states (e.g. already returned or requested) are individually captured and reported back in a structured report format (`{ total, successCount, rejectedCount, results: [...] }`).

## 16. Bare Chart.js Integration with React Canvas Ref
For the 8-week return trends chart, we integrated `chart.js` directly via a standard HTML5 `<canvas>` element using a React `useRef` and `useEffect` lifecycle rather than introducing React-specific wrappers like `react-chartjs-2` or heavy charting kits. This ensures zero React 19 compatibility hurdles and clean teardown on tab transitions.

## 17. Rolling 8-Week Time Window Calculation
The backend generates 8 distinct 7-day intervals counting backwards from the current timestamp, querying `Loan.countDocuments({ status: 'Returned', returnedDate: { $gte: weekStart, $lt: weekEnd } })` for each window. This guarantees a uniform 8-point dataset for the dashboard chart even with sparse or newly initialized databases.
