# AGENTS.md

## Project

This repository contains the **Consumption War Selection System**, a one-time event web application for selecting consumption categories with limited quotas.

Read `PRD.md` before making product or architecture decisions.

Core product characteristics:

- Mobile-first
- Reactive frontend
- Real-time quota updates
- Concurrency-safe selection
- Native PostgreSQL
- Participant and Admin interfaces
- No custom domain requirement
- Application accessed through a public server IP

---

# 1. General Rules

## Read Before Coding

Before implementing a feature:

1. Read `PRD.md`.
2. Inspect the existing project structure.
3. Inspect related code before modifying it.
4. Reuse existing patterns when appropriate.
5. Do not introduce a new library when the existing stack can solve the problem cleanly.
6. Do not rewrite unrelated code.

Do not assume that a feature is required just because it seems useful.

Follow the PRD first.

---

# 2. Engineering Priorities

Prioritize engineering decisions in this order:

1. Correctness
2. Data integrity
3. Concurrency safety
4. Security
5. Reliability
6. User experience
7. Performance
8. Maintainability
9. Developer convenience

Never sacrifice quota correctness for frontend responsiveness.

Never sacrifice security for implementation speed.

---

# 3. Source of Truth

PostgreSQL is the authoritative source of truth.

PostgreSQL is authoritative for:

- Event state
- Participant state
- Category state
- Remaining quota
- Selection state
- Selection timestamps

The frontend must never be treated as authoritative.

Realtime events must never be treated as authoritative.

Any client-side state is a representation of server state.

---

# 4. Selection Integrity

Selection is the most critical business operation in the application.

A successful selection must guarantee:

1. The event is open.
2. The participant is valid.
3. The participant has not already selected.
4. The category is valid and active.
5. The category has available quota.
6. Exactly one quota is allocated.
7. Exactly one selection is created.

These operations must be transactionally safe.

A failure in any part of the operation must not leave partial state.

---

# 5. Concurrency

The application is intentionally designed for simultaneous selection requests.

Assume multiple users may click the same category at nearly the same time.

Never implement quota allocation using:

```text
SELECT remaining_quota
↓
if remaining_quota > 0
↓
UPDATE remaining_quota
```

as separate application-level operations without concurrency protection.

Prefer atomic database operations or properly isolated transactions.

The database must guarantee:

- `remaining_quota >= 0`
- successful selections never exceed available quota
- quota cannot be allocated twice
- concurrent requests cannot oversubscribe a category

Always test the last-quota scenario.

Example:

```text
quota = 1

User A → select
User B → select
User C → select
```

Expected result:

```text
Exactly one success
Two failures
remaining_quota = 0
```

---

# 6. Database Constraints

Business invariants should be enforced at the database level whenever practical.

Examples:

- One participant can have at most one selection per event.
- Remaining quota cannot become negative.
- Foreign key relationships must remain valid.

Do not rely solely on frontend validation.

Do not rely solely on backend checks when a database constraint can enforce the invariant safely.

---

# 7. Transactions

Use database transactions for operations that modify multiple related records.

For selection:

```text
BEGIN
  Validate eligibility
  Allocate quota
  Create selection
COMMIT
```

On failure:

```text
ROLLBACK
```

Do not allow quota allocation and selection creation to become inconsistent.

---

# 8. Realtime Architecture

Realtime exists to propagate server state.

Realtime is not the source of truth.

Expected flow:

```text
Client
  ↓
Backend
  ↓
PostgreSQL transaction
  ↓
Commit
  ↓
Realtime event
  ↓
Connected clients
```

Only publish state-changing realtime events after the database transaction has successfully committed.

Do not publish a successful quota update before the transaction is committed.

---

# 9. Realtime Recovery

Clients must handle:

- connection loss
- reconnect
- missed events
- stale state

After reconnecting, the client must be able to resynchronize with the server.

Do not assume that every realtime event will always be received.

A client that misses an event must still be able to recover the correct state.

---

# 10. Frontend Rules

The frontend is mobile-first.

Optimize the primary experience for:

- 320px
- 375px
- 390px
- 430px

Desktop support is required, but mobile is the primary design target.

The participant should be able to understand:

- whether selection is open
- which categories are available
- how much quota remains
- how to select

with minimal interaction.

---

# 11. UI Design Principles

The product must not look like a generic AI-generated SaaS dashboard.

Avoid:

- excessive gradients
- unnecessary glassmorphism
- excessive rounded cards
- excessive shadows
- excessive decorative icons
- generic dashboard templates
- excessive animation
- unnecessary statistic cards
- decorative elements without functional purpose

The UI should feel intentional and event-specific.

Prefer:

- strong typography hierarchy
- clear quota visibility
- high information density without clutter
- large mobile-friendly interaction targets
- purposeful animation
- immediate interaction feedback
- clear status changes

Do not add visual effects merely because a UI library provides them.

---

# 12. Optimistic UI

Do not optimistically decrement quota.

Incorrect:

```text
User sees quota = 1
User clicks
Frontend immediately displays quota = 0
Server has not confirmed the selection
```

Correct:

```text
User clicks
 ↓
Loading state
 ↓
Server validates and allocates quota
 ↓
Server confirms
 ↓
Realtime/server state updates UI
```

The backend response determines whether the participant won the quota.

---

# 13. Error Handling

User-facing error messages must be understandable.

Do not expose raw technical errors such as:

```text
HTTP 409
SQLSTATE
PostgreSQL error
stack trace
```

Translate technical errors into appropriate user-facing states.

Examples:

```text
Kategori baru saja habis.
```

```text
Kamu sudah memiliki pilihan.
```

```text
Pemilihan sudah ditutup.
```

```text
Koneksi terputus. Mencoba menghubungkan kembali...
```

Technical details may be logged internally.

---

# 14. API Design

The backend is responsible for business rules.

Never trust:

- participant IDs
- category IDs
- event IDs
- quota values
- event status
- selection status

provided by the client.

Validate all business-critical values on the server.

Use consistent HTTP status codes and structured error responses.

Avoid exposing internal database structures directly through the API.

---

# 15. Authentication and Authorization

Participant access and Admin access must be treated separately.

Admin operations must be authorized on the server.

Do not rely on:

```text
if (isAdmin) show admin button
```

as the only security mechanism.

Hiding a frontend button is not authorization.

Every protected admin endpoint must validate authorization server-side.

---

# 16. Database Access

The browser must never connect directly to PostgreSQL.

Required architecture:

```text
Browser
  ↓
Backend
  ↓
PostgreSQL
```

Never:

```text
Browser
  ↓
PostgreSQL
```

Database credentials must never be exposed to the frontend bundle.

---

# 17. Environment Variables

Never hardcode:

- database credentials
- secrets
- authentication keys
- private tokens
- production passwords

Maintain:

```text
.env.example
```

with all required environment variables but without real secrets.

Example:

```text
DATABASE_URL=
APP_URL=
API_URL=
JWT_SECRET=
```

Use environment-specific configuration.

---

# 18. Deployment

The application is intended for one-time event usage.

Custom domain is not required.

The application may be accessed using a public server IP.

Example:

```text
http://103.xxx.xxx.xxx
```

PostgreSQL runs natively on a VPS.

PostgreSQL should not be publicly accessible from arbitrary internet clients.

Prefer:

```text
Application Server
      ↓
Restricted Database Connection
      ↓
PostgreSQL VPS
```

Use firewall rules to restrict PostgreSQL access.

---

# 19. Architecture Simplicity

Avoid unnecessary infrastructure.

Do not introduce:

- Kubernetes
- microservice architecture
- Redis
- message queues
- service meshes
- complex cloud infrastructure

unless there is a concrete requirement.

The system is a one-time event application.

Prefer a simple architecture that is:

- reliable
- understandable
- easy to deploy
- easy to debug
- easy to remove after the event

---

# 20. Technology Decisions

The current recommended stack is:

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- NestJS
- TypeScript

### Database

- PostgreSQL Native

### ORM

- Drizzle ORM

### Realtime

- Socket.IO

### Reverse Proxy

- Nginx

These are recommendations, not immutable requirements.

If changing a technology is necessary, explain:

1. Why it is needed.
2. What problem it solves.
3. What tradeoffs it introduces.

Do not replace technology merely because another library is personally preferred.

---

# 21. Code Quality

Prefer simple and explicit code.

Avoid:

- unnecessary abstractions
- premature generic utilities
- deeply nested logic
- duplicated business rules
- hidden side effects
- overly clever code

Business-critical code should be easy to inspect.

Especially prioritize readability in:

- selection service
- quota allocation
- transaction handling
- authorization
- realtime synchronization

---

# 22. TypeScript

Use TypeScript strictly.

Prefer explicit domain types.

Avoid:

```ts
any
```

unless there is a documented reason.

Do not suppress TypeScript errors simply to make the build pass.

Fix the underlying problem.

---

# 23. Validation

Validate at multiple appropriate boundaries:

```text
Client
↓
API
↓
Service
↓
Database
```

Client validation improves UX.

Server validation guarantees correctness.

Database constraints protect data integrity.

These layers serve different purposes and should not be treated as substitutes for one another.

---

# 24. Testing

Every business-critical feature must have automated tests.

At minimum, test:

### Selection

- successful selection
- already selected participant
- sold-out category
- inactive category
- event not open
- invalid participant
- invalid category

### Concurrency

- quota = 1 with concurrent requests
- quota = N with concurrent requests
- failed transaction rollback

### Realtime

- quota update
- sold-out event
- reconnect
- state resynchronization

### Admin

- authorized admin request
- unauthorized request
- invalid admin operation

---

# 25. Testing the War Scenario

Do not consider selection complete until concurrency behavior has been tested.

The most important test is:

```text
Category quota = 1
N simultaneous selection requests
```

Expected:

```text
successful selections = 1
failed selections = N - 1
remaining quota = 0
```

There must never be:

```text
successful selections > quota
```

---

# 26. End-to-End Testing

Use end-to-end tests for the primary participant flow:

```text
Open application
↓
Enter name
↓
Waiting room
↓
Countdown
↓
Selection opens
↓
Select category
↓
Success
↓
Cannot select again
```

Also test:

```text
Participant A takes last quota
↓
Participant B sees sold out
```

---

# 27. Observability

The application should provide enough logging to diagnose event-time problems.

Log important backend events such as:

- event opened
- event closed
- selection success
- selection failure
- quota exhausted
- authorization failure
- database transaction failure
- WebSocket connection/reconnection

Never log sensitive secrets.

Do not log passwords or authentication tokens.

---

# 28. Logging Selection Events

A successful selection should be traceable using:

```text
eventId
participantId
categoryId
timestamp
requestId
```

This helps investigate disputes during the event.

---

# 29. API and Database Changes

When changing database schema:

1. Create a migration.
2. Update the schema definitions.
3. Update related types.
4. Update affected services.
5. Update tests.
6. Verify migration on a clean database.

Do not modify production database structures manually without a corresponding migration.

---

# 30. Migration Safety

Database migrations should be:

- deterministic
- versioned
- reversible when practical
- safe to run repeatedly only when supported by the migration system

Do not delete existing production data as part of a normal migration unless explicitly required.

---

# 31. Documentation

Keep documentation updated when architecture or developer workflows change.

At minimum maintain:

```text
README.md
PRD.md
AGENTS.md
.env.example
```

README should explain:

- project setup
- required dependencies
- environment variables
- database setup
- migration commands
- development commands
- production build
- deployment basics

---

# 32. Git Workflow

Make focused changes.

Prefer small, logically grouped commits.

Do not mix:

```text
feature implementation
+
unrelated refactor
+
formatting entire project
```

in one change.

Before committing, run appropriate:

```text
typecheck
lint
test
build
```

Do not commit secrets, generated credentials, or local environment files.

---

# 33. Agent Workflow

When implementing a task:

### Step 1: Understand

Read:

- PRD.md
- AGENTS.md
- relevant source files
- relevant tests

### Step 2: Plan

Briefly identify:

- affected modules
- database changes
- API changes
- frontend changes
- testing requirements

### Step 3: Implement

Make the smallest coherent change that solves the requirement.

### Step 4: Verify

Run relevant:

- tests
- type checking
- lint
- build

### Step 5: Review

Check:

- concurrency implications
- security implications
- realtime implications
- mobile UX
- regression risk

### Step 6: Summarize

Report:

- what changed
- files changed
- tests run
- known limitations
- next recommended step

---

# 34. Do Not Over-Engineer

This is a one-time event application.

Favor:

```text
simple + reliable
```

over:

```text
complex + scalable for hypothetical future traffic
```

Do not introduce infrastructure or abstractions without a concrete requirement.

---

# 35. Definition of Done

A feature is not complete merely because the code compiles.

A feature is complete when:

1. The requirement is implemented.
2. Business rules are enforced server-side.
3. Database integrity is protected.
4. Relevant tests exist.
5. Tests pass.
6. Type checking passes.
7. Lint passes.
8. Production build passes.
9. Relevant realtime behavior works.
10. UI handles loading, success, and failure states.
11. Mobile layout is usable.
12. No known critical regression remains.

---

# 36. Critical Invariants

The following invariants must never be violated:

```text
remaining_quota >= 0
```

```text
successful selections <= initial quota
```

```text
one participant = one selection per event
```

```text
browser ≠ direct database access
```

```text
realtime ≠ source of truth
```

```text
frontend ≠ authorization
```

```text
client state ≠ quota authority
```

---

# 37. Final Principle

When in doubt, preserve these three properties above all else:

1. **Fast Mobile UX**
2. **Real Time Quota**
3. **Concurrency Safe Allocation**

The application should feel fast to the participant while remaining strictly correct at the database level.

Correctness always wins over animation, optimistic UI, convenience, or visual effects.
