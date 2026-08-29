# Database Schema Design

This document details the MongoDB collections, schemas, and relationships implemented via Mongoose.

## 1. User Schema (`users`)
Stores application users, their hashed credentials, and role assignments.

| Field | Type | Validation / Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Automatically generated | Primary key |
| `username` | String | Required, unique, trimmed | User's unique handle |
| `password` | String | Required | Hashed password |
| `role` | String | Required, enum: `['member', 'librarian']`, default: `'member'` | Controls access levels |
| `createdAt` | Date | Auto-populated | Record creation timestamp |
| `updatedAt` | Date | Auto-populated | Record modification timestamp |

---

## 2. Item Schema (`items`)
Stores the catalog items available for borrowing.

| Field | Type | Validation / Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Automatically generated | Primary key |
| `name` | String | Required, trimmed | Title/name of the item |
| `category` | String | Required, trimmed | Category grouping (e.g., Book, Laptop) |
| `status` | String | Required, enum: `['available', 'borrowed']`, default: `'available'` | Current borrowable status |
| `borrowedBy` | ObjectId (User) | Refers to `User`, default `null` | Reference to user who has currently borrowed the item |
| `createdAt` | Date | Auto-populated | Record creation timestamp |
| `updatedAt` | Date | Auto-populated | Record modification timestamp |

---

## 3. Loan Schema (`loans`)
Tracks active borrowings and overdue statuses.

| Field | Type | Validation / Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Automatically generated | Primary key |
| `item` | ObjectId (Item) | Required, Refers to `Item` | Item being borrowed |
| `borrower` | ObjectId (User) | Required, Refers to `User` | User borrowing the item |
| `borrowDate` | Date | Required, default: `Date.now` | When the borrowing transaction occurred |
| `dueDate` | Date | Required | Target return date |
| `status` | String | Required, enum: `['active', 'returned', 'overdue']`, default: `'active'` | Status of active loan |
| `returnedDate`| Date | Optional | When the item was returned (if returned) |

---

## 4. LoanHistory Schema (`loanhistories`)
Maintains an immutable historical record of all completed loan transactions for audit purposes.

| Field | Type | Validation / Constraints | Description |
|---|---|---|---|
| `_id` | ObjectId | Automatically generated | Primary key |
| `item` | ObjectId (Item) | Required, Refers to `Item` | Item that was borrowed |
| `borrower` | ObjectId (User) | Required, Refers to `User` | User who borrowed the item |
| `borrowDate` | Date | Required | Original borrowing date |
| `dueDate` | Date | Required | Original due date |
| `returnDate` | Date | Required, default: `Date.now` | Actual date returned |
| `statusAtReturn`| String | Required, enum: `['returned', 'returned-overdue']` | Status at the point of return |

