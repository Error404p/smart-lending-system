# AI Prompts History

These are the rough instructions given to set up today's code:

1. Scaffold: "Initialize a fresh empty git repo, delete the old .git history. Setup package.json in root, backend and frontend folder placeholders, and add stub files under docs/."
2. Schemas: "Write User schema (member vs librarian role), Item schema (available vs borrowed), Loan, and LoanHistory schemas using Mongoose."
3. Auth middleware & routes: "Build register and login routes. Register should hash password with bcryptjs and issue token. Middleware needs to verify JWT and restrict access based on roles."
4. Loan lifecycle & guards: "Implement requested, issued, returned, and lost loan lifecycle transitions. Add a MongoDB partial unique index on active loans (Requested/Issued) per item as a concurrency checkout guard. Setup automated testing with MongoMemoryServer."
5. Audit, Custodians & Overdue Alerts: "Audit registration endpoint to prevent client-supplied role assignment. Add many-to-many librarians to catalogue items custodianship. Create append-only history timeline entries for every transition with authors and notes. Build overdue alert lists with scoped loan-level dismissals. Boot a React client in the frontend using Vite and plain CSS styles."
6. Server-Side Search, Filtering, Sorting & Pagination: "Implement server-side search over item title and borrower, filter by status, item, and borrower, sort by due date, requested date, and status, and paginate with total match counts and total pages. Enforce role permissions strictly on the server by pinning member queries to their own user ID. Wire up the React frontend list view with plain CSS filter controls and pagination buttons."
