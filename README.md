

# Smart Lending System

A full-stack web application for tracking shared equipment loans, built to replace a paper sign-out sheet.

Librarians manage a catalogue and issue or return items, members request what they need, and every loan moves through a server-enforced `Requested → Issued → Returned` lifecycle. Includes custodianship, immutable audit history, overdue alerting, bulk actions, and a dashboard.

**Live demo:** https://smart-lending-system.vercel.app/
*(backend is on Render's free tier — the first request after inactivity can take 30–60s to wake up)*

## Features

- Librarian and member login with role-based access
- Add, edit and catalogue items by category
- Assign librarians as custodians of specific items and filter the catalogue to just what they're responsible for
- Members request items; librarians issue and return loans
- Server-enforced loan lifecycle: `Requested → Issued → Returned`, with a branch to `Lost`
- Partial unique index on the `Loan` collection prevents an item from being issued twice at once, even under concurrent requests
- Overdue status is computed on read (`Issued` + past due date), not stored
- Overdue alerts with per-loan dismissal — reactivates if the same item goes out again and becomes overdue on a new loan
- Immutable loan history — every status change is logged with who, when and notes, and cannot be edited or deleted
- Search, filter, sort and pagination handled server-side
- CSV bulk import for catalogue items with a per-row failure report
- Bulk-return for multiple loans at once
- CSV export of everything currently on loan
- Dashboard with items out, overdue count, returns this week, and an 8-week return trend chart

## Roles

### LIBRARIAN

Librarians manage the catalogue and have full visibility into loans.

They can:
- Add and manage catalogue items
- Assign and remove custodians for items
- Issue, return and mark loans as lost
- Bulk-return loans and export loan data as CSV
- Bulk-import catalogue items via CSV
- View and dismiss overdue alerts
- View dashboard metrics
- View all users and other librarians

### MEMBER

Members have access limited to requesting items and tracking their own loans.

They can:
- Browse the catalogue
- Request items
- View their own loan history and timeline

Member access to librarian-only endpoints is rejected by the backend, not just hidden in the UI.

## Tech Stack

- React 19 (Vite)
- Chart.js
- Node.js
- Express
- MongoDB
- Mongoose
- JWT
- bcryptjs

## Project Structure

```
smart-lending-system/
├── backend/
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── Item.js
│   │   ├── Loan.js
│   │   ├── LoanHistory.js
│   │   └── User.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── items.js
│   │   └── loans.js
│   ├── seed.js
│   ├── server.js
│   ├── start-db.js
│   └── test_*.js
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   └── vite.config.js
│
├── docs/
│   ├── architecture.md
│   ├── schema.md
│   ├── plan.md
│   ├── decisions.md
│   └── ai-prompts.md
│
├── render.yaml
└── package.json
```

## Setup

### Prerequisites

You need:
- Node.js 18 or newer
- npm

A local MongoDB instance is not required — the dev setup runs on `mongodb-memory-server`.

### 1. Clone the project

```bash
git clone https://github.com/Error404p/smart-lending-system.git
cd smart-lending-system
```

### 2. Install dependencies (root, backend and frontend)

```bash
npm run install:all
```

### 3. Start a local database

```bash
node backend/start-db.js
```

### 4. Seed demo data

In another terminal:

```bash
npm run seed
```

### 5. Run the backend and frontend

In separate terminals:

```bash
npm run backend    # http://localhost:5000
npm run frontend   # http://localhost:5173
```

## Demo Accounts

The seed script creates a few of each role so you can see how permissions differ.

| Role | Username | Password |
|---|---|---|
| Librarian (lead) | `librarian` | `password123` |
| Librarian | `librarian_bob` | `password123` |
| Librarian | `librarian_carol` | `password123` |
| Member | `member1` | `password123` |
| Member (has an overdue loan) | `member2` | `password123` |
| Member | `member3` – `member5` | `password123` |

## API

The backend exposes REST APIs for the main parts of the application.

Main API areas include:

```text
/api/auth
/api/items
/api/loans
/api/dashboard
```

Some important endpoints include:

```
POST    /api/auth/register
POST    /api/auth/login
GET     /api/auth/users

GET     /api/items
POST    /api/items
POST    /api/items/bulk-import
GET     /api/items/custodian
POST    /api/items/:id/custodians
DELETE  /api/items/:id/custodians/:userId

GET     /api/loans
POST    /api/loans
GET     /api/loans/:id
GET     /api/loans/:id/timeline
GET     /api/loans/overdue
GET     /api/loans/export
POST    /api/loans/bulk-return
PATCH   /api/loans/:id/issue
PATCH   /api/loans/:id/return
PATCH   /api/loans/:id/lost
PATCH   /api/loans/:id/dismiss-alert

GET     /api/dashboard/stats
```

Authentication is handled using JWT bearer tokens.

## Server-Side Rules

The frontend is not treated as the source of truth for important business rules. The backend checks:

- User roles and permissions on every mutating endpoint
- One open loan (`Requested` or `Issued`) per item, enforced with a partial unique index
- Valid loan status transitions
- Overdue computation on read, not on write
- Custodian assignment before allowing custodian-scoped filtering

## Loan Statuses

Loans can have the following statuses:

```
Requested
Issued
Returned
Lost
```

For example:

```
Requested -> Issued
Requested -> Returned  (rejected without issue)
Issued    -> Returned
Issued    -> Lost
```

Invalid transitions are rejected by the backend.

## Testing

```bash
npm run test
```

Runs three suites from the backend:

- `test_lifecycle.js` — loan lifecycle and concurrency guards (double-issue prevention)
- `test_day5.js` — bulk actions and dashboard stats
- `test_audit.js` — role-enforcement audit across every mutating endpoint

## Frontend Build

To create a production build:

```bash
cd frontend
npm run build
```

## Documentation

More detailed project information is available in the `docs` folder:

- `architecture.md` — application architecture, auth model and endpoint table
- `schema.md` — MongoDB collections, relationships and indexes
- `plan.md` — implementation plan and progress
- `decisions.md` — technical decisions and reasoning
- `ai-prompts.md` — prompts used during development and correction notes

## Deployment

`render.yaml` and `frontend/vercel.json` are set up for deployment. Roughly:

1. Spin up a MongoDB Atlas free cluster
2. Point Render at `backend/` with the Atlas connection string as `MONGO_URI`
3. Point Vercel at `frontend/` with `VITE_API_URL` set to your Render backend URL

Full walkthrough with exact settings is in `SUBMISSION.md`.
