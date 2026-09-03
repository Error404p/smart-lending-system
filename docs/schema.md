# Database Schema Design

This document details the MongoDB collections, schemas, compound indexes, and relationships implemented via Mongoose in the Asset Lending System.

---

## 1. User Schema (`users`)
Stores application accounts, their bcrypt-hashed credentials, and role privileges.

| Field | Type | Validation / Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Automatically generated | Primary key |
| `username` | String | Required, unique, trimmed | User's unique system handle |
| `password` | String | Required | Hashed password (`bcryptjs`, 10 salt rounds) |
| `role` | String | Required, enum: `['member', 'librarian']`, default: `'member'` | Access level control |
| `createdAt` | Date | Auto-populated | Account creation timestamp |
| `updatedAt` | Date | Auto-populated | Account modification timestamp |

---

## 2. Item Schema (`items`)
Stores the catalog assets available for loan with many-to-many librarian custodianship.

| Field | Type | Validation / Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Automatically generated | Primary key |
| `name` | String | Required, trimmed | Title / model name of the item |
| `category` | String | Required, trimmed | Category grouping (e.g. Laptops, Cameras, Audio, VR & Drones) |
| `status` | String | Required, enum: `['available', 'borrowed', 'lost']`, default: `'available'` | Physical availability status in the library catalogue |
| `borrowedBy` | ObjectId (User) | Refers to `User`, default `null` | Reference to the member currently holding the item on loan |
| `custodians` | Array of ObjectId (User) | Refers to `User` | Array of librarian user IDs managing this catalogue asset |
| `createdAt` | Date | Auto-populated | Asset creation timestamp |
| `updatedAt` | Date | Auto-populated | Asset modification timestamp |

---

## 3. Loan Schema (`loans`)
Tracks the full lifecycle of loan requests, active checkouts, completed returns, and lost items.

| Field | Type | Validation / Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Automatically generated | Primary key |
| `item` | ObjectId (Item) | Required, Refers to `Item` | Asset involved in the loan transaction |
| `borrower` | ObjectId (User) | Required, Refers to `User` | Member who requested / borrowed the asset |
| `borrowDate` | Date | Required, default: `Date.now` | Checkout / issue transaction timestamp |
| `dueDate` | Date | Required | Agreed return deadline |
| `status` | String | Required, enum: `['Requested', 'Issued', 'Returned', 'Lost']`, default: `'Requested'` | Current lifecycle stage of the loan |
| `returnedDate` | Date | Optional | Timestamp when the item was returned by the member |
| `alertDismissed` | Boolean | Required, default: `false` | Scoped dismissal flag for librarian overdue notification triage |
| `createdAt` | Date | Auto-populated | Loan creation timestamp |
| `updatedAt` | Date | Auto-populated | Loan modification timestamp |

### Virtual Properties & Dynamic Fields
- **`isOverdue` (Virtual)**: Evaluated dynamically in memory as `this.status === 'Issued' && this.dueDate < new Date()`. Overdue state is **never stored as a hardcoded status string**, preventing stale state drift across system restarts.

### Database-Level Concurrency Guard
- **Partial Unique Index on `{ item: 1 }`**:
  ```javascript
  LoanSchema.index(
    { item: 1 },
    {
      unique: true,
      partialFilterExpression: { status: { $in: ['Requested', 'Issued'] } }
    }
  );
  ```
  Guarantees atomically at the database layer that no asset can have more than one open loan (`Requested` or `Issued`) concurrently, preventing double-checkout race conditions without requiring replica-set transactions.

---

## 4. LoanHistory Schema (`loanhistories`)
Maintains an append-only timeline of every state transition across the loan lifecycle with actor accountability and contextual notes.

| Field | Type | Validation / Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Automatically generated | Primary key |
| `loan` | ObjectId (Loan) | Required, Refers to `Loan` | The loan transaction instance |
| `item` | ObjectId (Item) | Required, Refers to `Item` | The asset reference |
| `borrower` | ObjectId (User) | Required, Refers to `User` | The member reference |
| `state` | String | Required, enum: `['Requested', 'Issued', 'Returned', 'Lost']` | Lifecycle state entered at this transition |
| `changedBy` | ObjectId (User) | Required, Refers to `User` | User ID of the librarian or member authoring the change |
| `note` | String | Optional, default: `''` | Librarian handover remarks, damage reports, or member request reasoning |
| `createdAt` | Date | Auto-populated | Timestamp of this timeline event |
| `updatedAt` | Date | Auto-populated | Modification timestamp |

---

## Schema Entity Relationships

```
+---------------+          1:N          +---------------+
|     User      | --------------------> |     Loan      |
| (role: member)|                       | (status: ...) |
+---------------+                       +---------------+
        ^                                       |
        | 1:N (custodians)                      | 1:N
        |                                       v
+---------------+          1:N          +---------------+
|     Item      | --------------------> |  LoanHistory  |
| (status: ...) |                       | (state event) |
+---------------+                       +---------------+
```
