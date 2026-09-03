# Point to be noted i am an ml engineer and i have learned backend for this please don't consider it to be that much fancy

# Asset Lending System

A small MERN app for tracking shared equipment loans — built to replace a paper sign-out sheet.
Librarians manage a catalogue and issue/return items, members request what they need, and every
loan moves through a server-enforced lifecycle so two people can't walk off with the same camera.

**Live:** https://smart-lending-system.vercel.app/
*(backend is on Render's free tier, so the first request after a while can take 30–60s to wake up)*

## What it does

- **Two roles.** Librarians manage the catalogue, issue/return loans, and see everything. Members
  can only request items and see their own loan history. This is enforced on the server, not just
  hidden in the UI — a member hitting a librarian-only endpoint directly gets a 403.
- **Loan lifecycle.** `Requested → Issued → Returned`, with a branch to `Lost`. Overdue isn't a
  stored status — it's computed on read (`Issued` + past due date). A partial unique index on the
  `Loan` collection stops an item from being issued twice at once, even under concurrent requests.
- **Custodians.** Librarians can be assigned as custodians of specific items and filter the
  catalogue down to just what they're responsible for.
- **Immutable history.** Every state change on a loan is logged — who did it, when, and any notes.
  Nothing in that log can be edited or deleted afterward.
- **Overdue alerts.** Shows up in a nav badge, dismissible per loan — if the same item goes out
  again and becomes overdue on the new loan, the alert comes back.
- **Search, filter, sort, pagination** — all server-side, so the browser never loads more than one
  page of results.
- **Bulk actions.** CSV import for catalogue items (with a per-row report on what failed and why),
  bulk-return for multiple loans at once, and CSV export of everything currently on loan.
- **Dashboard.** Items out, overdue count, returns this week, plus an 8-week return trend chart.

## Stack

Kept deliberately basic — MongoDB, Express, React (Vite), Node, plain CSS, JWT auth, and Chart.js
for the one chart the dashboard needs. No UI kit, no state management library, nothing beyond what
the features actually required.

## Running it locally

```bash
npm run install:all
```

Start a local database (uses `mongodb-memory-server`, no separate Mongo install needed):

```bash
node backend/start-db.js
```

In another terminal, seed it with demo data:

```bash
npm run seed
```

Then run the backend and frontend (separate terminals):

```bash
npm run backend    # http://localhost:5000
npm run frontend   # http://localhost:5173
```

## Demo accounts

Seeded data includes a few of each role so you can see how permissions actually differ:

| Role | Username | Password |
|---|---|---|
| Librarian (lead) | `librarian` | `password123` |
| Librarian | `librarian_bob` | `password123` |
| Librarian | `librarian_carol` | `password123` |
| Member | `member1` | `password123` |
| Member (has an overdue loan) | `member2` | `password123` |
| Member | `member3` – `member5` | `password123` |

## Tests

```bash
npm run test
```

Runs three suites: loan lifecycle + concurrency guards, bulk actions + dashboard, and a
role-enforcement audit that checks every mutating endpoint actually rejects the wrong role.

## Docs

More detail lives in `docs/` — `architecture.md` (request flow, auth model, endpoint table),
`schema.md`, `decisions.md` (what got picked, what got reversed, and why), and `plan.md`.

## Deploying your own copy

`render.yaml` and `frontend/vercel.json` are already set up. Roughly: spin up a MongoDB Atlas
free cluster, point Render at `backend/` with the Atlas connection string as `MONGO_URI`, then
point Vercel at `frontend/` with `VITE_API_URL` set to your Render URL. Full walkthrough with
exact settings is in `SUBMISSION.md`.
