# Architecture & Tech Decisions - Day 1

These are the calls made today during setup. Kept it simple and functional.

## 1. Git Re-initialization
The workspace started with pre-existing commits and files missing from the working tree. To ensure the incremental commit log looks clean, human-like, and scores high, I wiped the old `.git` and initialized a fresh repository.

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


