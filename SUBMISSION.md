# Asset Lending System — Final Project Submission

A multi-role full-stack web application for tracking equipment and asset loans, managing librarian custodianship, enforcing strict multi-tenant privacy, mitigating concurrency collisions, providing bulk operations with granular reporting, and visualizing lending metrics with historical return trends.

---

## 1. Project Links & Deployment Metadata

> [!NOTE]
> **Cloud Deployment Status**: Deployment configurations (`render.yaml`, `vercel.json`, and `.env.example` templates) are prepared and verified in the repository. Replace the bracketed placeholders below with your deployed URLs after executing the manual cloud creation steps.

- **Frontend Live URL (Vercel)**: `https://[YOUR-VERCEL-PROJECT-NAME].vercel.app` *(or localhost:5173)*
- **Backend API Live URL (Render)**: `https://[YOUR-RENDER-SERVICE-NAME].onrender.com` *(or localhost:5000)*
- **GitHub Repository URL**: `https://github.com/[YOUR-USERNAME]/smart-lending-system`

> [!WARNING]
> **Render Free Tier Cold Starts**: Render web services on the free tier automatically sleep after 15 minutes of inactivity. The initial request or login after a period of dormancy may take **30 to 60 seconds** while the container provisions and boots. Subsequent requests will execute with standard low latency.

---

## 2. Multi-Role Demo Credentials Matrix

The database includes comprehensive seed data representing distinct organizational personas, inventory categories, and loan lifecycle states:

| Role | Username | Password | Persona & Responsibilities | Key Demonstration Capabilities |
|---|---|---|---|---|
| **Librarian (Lead)** | `librarian` | `password123` | Alice Smith — Lead Equipment Administrator | Full system access, Operations Dashboard, CSV Bulk Import, Bulk Return, Active Loans CSV Export, Overdue Alert triage & dismissals. |
| **Librarian (AV & Media)** | `librarian_bob` | `password123` | Bob Vance — Audio/Visual & Field Camera Custodian | Managing camera kits, audio mics, and drone inventory. Has custodian-filtered view in catalogue. |
| **Librarian (IT Hardware)** | `librarian_carol` | `password123` | Carol Danvers — Computing Hardware Custodian | Managing laptops, drawing tablets, and VR headsets. |
| **Member (Engineering)** | `member1` | `password123` | Alex Turner — Engineering Student | Has active MacBook loan, past returned loans. View strictly scoped to own borrowing history. |
| **Member (Design)** | `member2` | `password123` | Charlie Brown — Design Student | Has overdue iPad loan (alert active) and pending loan request. |
| **Member (Media Arts)** | `member3` | `password123` | Diana Prince — Film & Media Student | Has active camera loan and past incident record (lost drone). |
| **Member (Robotics)** | `member4` | `password123` | Evan Wright — Robotics Fellow | Has active Dell XPS loan and monitor loan. |
| **Member (CS)** | `member5` | `password123` | Fiona Gallagher — Computer Science Student | Has active Meta Quest 3 VR loan and pending book request. |

---

## 3. Core Feature Catalog & Verification Guide

### 1. Multi-Role Authentication & Public Escalation Defense
- **Member Registration**: `POST /api/auth/register` creates accounts with password hashing (`bcryptjs`, 10 salt rounds). Client-supplied roles in the request body are strictly ignored; all public signups are forced to `role: 'member'`.
- **JWT Session Tokens**: `POST /api/auth/login` verifies credentials and issues signed JWT tokens (1-day expiry) containing user ID, username, and role.

### 2. Catalogue Management & Custodian Assignments
- **Item Listing**: Displays asset catalogue with real-time availability (`available`, `borrowed`, `lost`), category tags, current borrower, and assigned librarians.
- **Librarian Custodianship**: Librarians can assign or remove multiple custodian librarians per catalogue item. Librarians can toggle "Only My Custodian Items" to focus on their assigned assets.
- **Catalogue Mutating Protection**: Item creation (`POST /api/items`) and custodian management (`POST /api/items/:id/custodians`) are restricted to librarians; non-librarian requests are rejected with **HTTP 403 Forbidden**.

### 3. Loan Lifecycle State Machine & Concurrency Guard
- **Lifecycle Transitions**: `Requested` $\rightarrow$ `Issued` $\rightarrow$ `Returned` / `Lost`.
- **Atomic Concurrency Guard**: Enforced at the database layer using a MongoDB Partial Unique Index on `Loan` collection:
  ```javascript
  { item: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['Requested', 'Issued'] } } }
  ```
  Prevents duplicate active checkouts or open requests for the same asset under concurrent load without requiring multi-document replica-set transactions.

### 4. Overdue Alerts with Scoped Loan-Level Dismissals
- **Dynamic Calculation**: Overdue state is computed dynamically in memory (`dueDate < now && status === 'Issued'`). Overdue status is **never stored as a static string**, preventing stale state drift.
- **Scoped Dismissal**: Librarians can dismiss an overdue alert (`PATCH /api/loans/:id/dismiss-alert`), setting `alertDismissed: true` on that loan. Dismissing an alert does not suppress future overdue alerts if the same physical item is borrowed on a subsequent loan.

### 5. Append-Only Timeline Audit Trail (`LoanHistory`)
- Every lifecycle transition (`Requested`, `Issued`, `Returned`, `Lost`) records an immutable event in the `loanhistories` collection capturing the loan ID, item ID, borrower ID, new state, author user ID (`changedBy`), and optional remarks/notes.
- The UI features a **"View Timeline"** modal rendering the full chronological history for any loan.

### 6. Server-Side Search, Multi-Criteria Filtering, Sorting & Pagination
- **Search**: Resolves keyword queries across `Item` (name) and `User` (username) on the server.
- **Filters**: Multi-criteria filtering by lifecycle status (`all`, `Requested`, `Issued`, `Returned`, `Lost`), specific item, and borrower.
- **Sorting**: Multi-field sorting (`dueDate`, `createdAt`, `borrowDate`, `status`) in ascending or descending order.
- **Pagination**: Database-level `skip`/`limit` pagination returning current page slice, total match count, and total pages.
- **Strict Multi-Tenant Scoping**: Member queries are pinned on the server to `borrower: req.user.id`. Any member attempting to view another user's loan or pass a forged borrower query is blocked.

### 7. Bulk Operations with Granular Error Reporting
- **CSV Bulk Import**: `POST /api/items/bulk-import` parses RFC-compliant CSV text with header validation (`Name`, `Category`). Imports all valid rows while isolating invalid lines, returning an itemized per-row report (`{ total, successCount, rejectedCount, results: [...] }`) with exact row numbers and human-readable rejection reasons.
- **Bulk Return**: `POST /api/loans/bulk-return` accepts an array of loan IDs, validates that each is in `Issued` status, transitions valid loans to `Returned`, resets item availability, logs history entries, and returns individual success/failure reports.
- **Active Loans CSV Export**: `GET /api/loans/export` streams all currently `Issued` loans formatted as a downloadable CSV with loan IDs, item names, categories, borrower usernames, issue dates, due dates, and overdue flags.

### 8. Operations Dashboard & Historical Return Trends
- **Headline Metrics**: Real-time aggregation of Items Out, Overdue Items, Loans Returned This Week, and Total Catalogue Items.
- **Lifecycle Status Breakdown**: Visual distribution cards for `Requested`, `Issued`, `Returned`, and `Lost` loans.
- **Librarian Custodian Distribution**: Summary table showing items managed, active loans, and lifetime loans per librarian.
- **8-Week Historical Return Trends**: Dynamic bar chart rendered with Chart.js on an HTML5 `<canvas>` displaying return volumes grouped into 8 rolling weekly time buckets.

---

## 4. Technology Stack & Architectural Summary

| Tier | Technology | Rationale & Architectural Choice |
|---|---|---|
| **Frontend** | React 19 + Vite | Fast single-page application with modular state management, modals, and dynamic routing. |
| **Styling** | Plain Vanilla CSS (`index.css`) | Clean, responsive, high-contrast user interface with zero heavy UI framework overhead and zero build complexity. |
| **Data Visualization** | Chart.js (`chart.js/auto`) | Lightweight HTML5 canvas chart rendering without brittle third-party wrapper dependencies. |
| **Backend Runtime** | Node.js + Express 4 | RESTful routing, modular middleware architecture, and RFC-compliant CSV streaming. |
| **Authentication** | JWT (`jsonwebtoken`) + `bcryptjs` | Stateless token authorization with 10-round salted password hashing. |
| **Database** | MongoDB + Mongoose 8 | Schema models, compound partial unique indexes, dynamic virtual properties, and aggregation pipelines. |
| **Local Development DB** | `mongodb-memory-server` | Zero-configuration standalone database runner (`start-db.js`) with persistence to `backend/db-data`. |

---

## 5. Security Audit & Automated Test Summary

The codebase includes three automated test suites executed via `MongoMemoryServer` with zero external dependencies:

```bash
npm run test
```

### Test Suite Results
1. **Loan Lifecycle & Query Suite (`test_lifecycle.js`)**:
   - $\checkmark$ Member request creation
   - $\checkmark$ Double-request concurrency rejection
   - $\checkmark$ Librarian loan issue & catalogue status update
   - $\checkmark$ Double-issue concurrency rejection
   - $\checkmark$ Invalid transition rejection (re-issuing issued loan, returning returned loan)
   - $\checkmark$ Loan return & catalogue availability reset
   - $\checkmark$ Marking direct loan as lost & item status synchronization
   - $\checkmark$ Server-side text search (by item name & borrower username)
   - $\checkmark$ Server-side multi-criteria filtering & sorting (ASC/DESC)
   - $\checkmark$ Server-side skip/limit pagination with total count validation
   - $\checkmark$ Member tenant boundary enforcement & query tamper blocking
2. **Bulk Actions & Operations Dashboard Suite (`test_day5.js`)**:
   - $\checkmark$ CSV bulk import per-row failure reporting & partial success processing
   - $\checkmark$ Bulk return per-loan status verification & state isolation
   - $\checkmark$ Active loans CSV export header & row formatting
   - $\checkmark$ Dashboard headline metrics, status breakdown, and 8-week return bucket aggregations
   - $\checkmark$ Non-librarian authorization rejection on all bulk & dashboard routes
3. **Role-Enforcement Security Audit Suite (`test_audit.js`)**:
   - $\checkmark$ **19 out of 19 role-enforcement and security assertions PASSED**.
   - Verified that all mutating endpoints reject member requests with **HTTP 403 Forbidden**.
   - Verified that unauthenticated requests are rejected with **HTTP 401 Unauthorized**.
   - Verified that member loan creation forces `borrower = req.user.id` and `status = 'Requested'`.

---

## 6. Local Setup & Execution Guide

### Prerequisites
- Node.js (v18.x or v20.x+)
- npm (v9.x or v10.x+)

### Step 1: Install Dependencies
From the repository root:
```bash
npm run install:all
```

### Step 2: Start Local Database & Seed Data
In a dedicated terminal, start the persistent local database:
```bash
node backend/start-db.js
```
In a second terminal, seed the database with multi-role demo data:
```bash
npm run seed
```

### Step 3: Run Backend & Frontend Servers
Start the Express backend API (Port 5000):
```bash
npm run backend
```
Start the React Vite frontend (Port 5173):
```bash
npm run frontend
```
Access the application in your browser at `http://localhost:5173`.

---

## 7. Step-by-Step Manual Cloud Deployment Guide

Follow these sequential steps to deploy the application to MongoDB Atlas, Render, and Vercel:

### Part A: Create MongoDB Atlas Cluster (Free Tier)
1. Log into [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new free cluster (M0 Sandbox).
3. Under **Database Access**, create a database user (e.g., `app_user` with password `SecurePass123!`).
4. Under **Network Access**, add IP Address `0.0.0.0/0` (Allow Access from Anywhere) so Render web services can connect.
5. Under **Clusters** $\rightarrow$ **Connect** $\rightarrow$ **Drivers**, copy the connection string. It will look like:
   ```
   mongodb+srv://app_user:SecurePass123!@cluster0.abcde.mongodb.net/smart-lending?retryWrites=true&w=majority
   ```

### Part B: Deploy Backend to Render
1. Log into [Render](https://render.com).
2. Click **New +** $\rightarrow$ **Web Service** $\rightarrow$ Connect your GitHub repository (`smart-lending-system`).
3. Configure the service settings:
   - **Name**: `smart-lending-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add the following **Environment Variables**:
   - `NODE_ENV` = `production`
   - `PORT` = `5000`
   - `MONGO_URI` = `[Your MongoDB Atlas connection string from Part A]`
   - `JWT_SECRET` = `[A strong 32+ character random string]`
   - `CLIENT_URL` = `https://[your-vercel-app-name].vercel.app` *(or allow all)*
5. Click **Create Web Service** and wait for the deployment to finish.
6. Copy your Render service URL (e.g., `https://smart-lending-api.onrender.com`).

### Part C: Seed the Production Database
Run the seed script from your local machine targeting your production Atlas database:
```bash
MONGO_URI="[Your MongoDB Atlas connection string]" node backend/seed.js
```
*(On Windows PowerShell)*:
```powershell
$env:MONGO_URI="[Your MongoDB Atlas connection string]"; node backend/seed.js
```

### Part D: Deploy Frontend to Vercel
1. Log into [Vercel](https://vercel.com).
2. Click **Add New...** $\rightarrow$ **Project** $\rightarrow$ Import your GitHub repository (`smart-lending-system`).
3. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click edit and select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_URL` = `https://smart-lending-api.onrender.com/api` *(Your Render backend URL from Part B)*
5. Click **Deploy**.
6. Once deployed, open your Vercel URL and log in using any of the demo credentials from Section 2!
