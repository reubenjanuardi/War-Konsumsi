# IMPLEMENTATION.md

## Consumption War Selection System

**Purpose:**  
This document breaks the requirements in `PRD.md` into an ordered implementation plan for AI coding agents and developers.

**Source documents:**

- `PRD.md` — product requirements and functional requirements
- `AGENTS.md` — engineering rules and coding constraints
- `IMPLEMENTATION.md` — execution order and implementation checklist

---

# 1. How to Use This File

Implementation should proceed sequentially.

Do not skip directly to the final UI before the core backend and database behavior has been verified.

Recommended execution order:

```text
Phase 0
Project Analysis
   ↓
Phase 1
Project Foundation
   ↓
Phase 2
Database
   ↓
Phase 3
Core Backend
   ↓
Phase 4
Concurrency Safe Selection
   ↓
Phase 5
Realtime
   ↓
Phase 6
Participant Frontend
   ↓
Phase 7
Admin Frontend
   ↓
Phase 8
Testing
   ↓
Phase 9
Deployment
   ↓
Phase 10
Production Readiness
```

Each phase has a Definition of Done.

An AI agent should complete and verify the current phase before moving to the next phase.

---

# 2. Global Rules

Before starting any phase:

- Read `PRD.md`.
- Read `AGENTS.md`.
- Inspect the current repository.
- Preserve existing working code unless there is a clear reason to change it.
- Do not introduce unnecessary dependencies.
- Do not over-engineer the architecture.
- Do not implement features outside the current phase unless required to unblock the phase.
- Run relevant tests and checks after each meaningful change.

Critical invariants:

```text
remaining_quota >= 0
successful selections <= initial quota
one participant = one selection per event
browser != direct database access
realtime != source of truth
frontend != authorization
client state != quota authority
```

---

# 3. Phase 0 — Project Analysis

## Objective

Understand the requirements and establish the implementation strategy before writing application code.

## Tasks

- [x] Read `PRD.md`.
- [x] Read `AGENTS.md`.
- [x] Inspect repository state.
- [x] Identify whether a project already exists.
- [x] Determine current tooling and package manager.
- [x] Confirm available runtime versions.
- [x] Confirm VPS PostgreSQL connection details are available through environment variables.
- [x] Produce a short architecture plan.
- [x] Identify any contradictions between existing code and the PRD.
- [x] Identify unresolved technical decisions.

## Expected Output

Create or update:

```text
docs/architecture.md
```

The architecture document should include:

- system overview
- frontend architecture
- backend architecture
- database architecture
- realtime architecture
- deployment topology
- major technology choices

## Definition of Done

- Repository has been inspected.
- Architecture is documented.
- No major unresolved architecture issue blocks implementation.

---

# 4. Phase 1 — Project Foundation

## Objective

Create the base project structure and development environment.

## Recommended Stack

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS

Backend:

- NestJS
- TypeScript

Database:

- PostgreSQL 17 in Docker (Docker Compose with persistent volume)

ORM:

- Drizzle ORM

Realtime:

- Socket.IO

Testing:

- Vitest
- Playwright

Infrastructure:

- Docker
- Nginx

These are recommendations rather than immutable requirements.

## Tasks

- [x] Initialize project.
- [x] Configure TypeScript.
- [x] Configure package manager.
- [x] Configure linting.
- [x] Configure formatting.
- [x] Configure basic testing.
- [x] Create frontend application.
- [x] Create backend application.
- [x] Create shared type/package structure if using a monorepo.
- [x] Configure environment variables.
- [x] Create `.env.example`.
- [x] Add basic health check endpoint.
- [x] Add application error handling foundation.
- [x] Add initial README.
- [x] Add Docker configuration if appropriate.

## Suggested Repository Structure

```text
consumption-war/
├── AGENTS.md
├── PRD.md
├── IMPLEMENTATION.md
├── README.md
├── .env.example
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── shared/
│   ├── types/
│   └── config/
├── docs/
└── docker/
```

## Verification

- [x] Frontend starts.
- [x] Backend starts.
- [x] Type checking passes.
- [x] Lint passes.
- [x] Tests can execute.
- [x] Production build succeeds.

## Definition of Done

A developer can clone the repository, install dependencies, configure environment variables, start the frontend/backend, and reach the backend health endpoint.

---

# 5. Phase 2 — Database Foundation

## Objective

Implement the PostgreSQL schema and database migration system.

## Database Entities

Required entities:

```text
events
participants
categories
selections
```

## Tasks

- [x] Configure PostgreSQL connection.
- [x] Configure Drizzle.
- [x] Create schema definitions.
- [x] Create migrations.
- [x] Add foreign keys.
- [x] Add indexes where appropriate.
- [x] Add unique constraints.
- [x] Add quota integrity constraints.
- [x] Implement migration commands.
- [x] Add seed/development data.
- [x] Verify a clean database can be migrated from scratch.

## Required Event Fields

```text
id
name
status
selection_starts_at
selection_ends_at
created_at
updated_at
```

Event statuses:

```text
DRAFT
WAITING
OPEN
CLOSED
```

## Required Participant Fields

```text
id
event_id
name
created_at
```

## Required Category Fields

```text
id
event_id
name
description
image_url
quota
remaining_quota
is_active
created_at
updated_at
```

## Required Selection Fields

```text
id
event_id
participant_id
category_id
selected_at
```

## Required Constraints

At minimum:

```text
UNIQUE(event_id, participant_id)
```

and:

```text
remaining_quota >= 0
```

Foreign key relationships must be enforced.

## Verification

- [x] Clean database migration works.
- [x] Seed data works.
- [x] Constraints work.
- [x] Duplicate participant selection is rejected.
- [x] Negative quota cannot be stored.

## Definition of Done

Database schema is versioned, migration-based, and protects core business invariants.

---

# 6. Phase 3 — Core Backend

## Objective

Implement the business domain and API without realtime.

## Modules

Recommended modules:

```text
events
participants
categories
selections
admin
```

## Tasks

### Events

- [x] Create event.
- [x] Get event.
- [x] Update event.
- [x] Open event.
- [x] Close event.
- [x] Validate event state transitions.

### Participants

- [x] Join event.
- [x] Get participant.
- [x] Validate participant.
- [x] Prevent invalid event membership.

### Categories

- [x] Create category.
- [x] Update category.
- [x] Get categories.
- [x] Enable/disable category.
- [x] Validate quota.

### Selections

- [x] Create selection endpoint.
- [x] Get participant selection.
- [x] Validate selection eligibility.
- [x] Return structured errors.

## API

Implement at minimum:

```http
GET  /api/events/:eventId
GET  /api/events/:eventId/categories
POST /api/events/:eventId/join
POST /api/events/:eventId/selections
GET  /api/events/:eventId/participants/:participantId/selection
```

## Server Validation

Every selection request must validate:

```text
event
participant
event status
participant selection status
category
category active status
category quota
```

## Important

Do not trust client-provided values.

Do not expose database credentials or internal database details.

## Verification

Test:

- [x] Valid event.
- [x] Invalid event.
- [x] Event not open.
- [x] Valid participant.
- [x] Invalid participant.
- [x] Valid category.
- [x] Invalid category.
- [x] Inactive category.
- [x] Already selected participant.

## Definition of Done

Core APIs work correctly under normal non-concurrent requests and all business validation happens server-side.

---

# 7. Phase 4 — Concurrency Safe Selection

## Objective

Guarantee correct quota allocation during simultaneous requests.

This is the highest-risk and most important backend phase.

## Required Behavior

For:

```text
SAPI = 1
```

and:

```text
User A → SAPI
User B → SAPI
User C → SAPI
```

the result must be:

```text
1 success
2 failures
remaining_quota = 0
```

## Tasks

- [x] Implement atomic quota decrement.
- [x] Implement transaction for quota + selection.
- [x] Ensure failed operations rollback.
- [x] Add database-level uniqueness enforcement.
- [x] Add concurrency integration tests.
- [x] Test quota = 1.
- [x] Test quota = N.
- [x] Test duplicate participant requests.
- [x] Test transaction failure.

## Preferred Atomic Pattern

Conceptually:

```sql
UPDATE categories
SET remaining_quota = remaining_quota - 1
WHERE id = $1
  AND remaining_quota > 0;
```

The implementation may use an equivalent safe database strategy.

## Required Selection Transaction

```text
BEGIN
   │
   ├── Validate eligibility
   │
   ├── Atomically allocate quota
   │
   ├── Create selection
   │
   └── COMMIT
```

Failure:

```text
ROLLBACK
```

## Verification

Run concurrent requests against the same category.

Verify:

```text
successful selections <= initial quota
```

and:

```text
remaining_quota >= 0
```

## Definition of Done

The concurrency test passes reliably and the database can never allocate more quota than exists.

---

# 8. Phase 5 — Realtime

## Objective

Propagate committed server state to connected clients.

## Technology

Recommended:

```text
Socket.IO
```

## Tasks

- [x] Add Socket.IO server.
- [x] Add client connection.
- [x] Add event subscription.
- [x] Implement quota update event.
- [x] Publish events only after successful transaction commit.
- [x] Implement reconnect behavior.
- [x] Implement state resynchronization.
- [x] Handle disconnected clients.
- [x] Handle stale client state.

## Event

```text
category.quota.updated
```

Payload:

```json
{
  "categoryId": "123",
  "remainingQuota": 1,
  "status": "AVAILABLE"
}
```

Sold out:

```json
{
  "categoryId": "123",
  "remainingQuota": 0,
  "status": "SOLD_OUT"
}
```

## Important Rule

Realtime is propagation only.

It is not authorization.

It is not quota allocation.

It is not the source of truth.

The source of truth remains PostgreSQL.

## Reconnect Strategy

After reconnecting:

```text
Connect
↓
Fetch current server state
↓
Replace stale client state
↓
Resume realtime subscription
```

## Verification

- [x] Quota update reaches connected clients.
- [x] Sold-out state reaches clients.
- [x] Client reconnects.
- [x] Client resynchronizes after missed events.
- [x] No event is published for rolled-back transactions.

## Definition of Done

Multiple clients can observe quota changes without page refresh and recover correctly after reconnect.

---

# 9. Phase 6 — Participant Frontend

## Objective

Build the primary mobile-first participant experience.

## Screens / States

```text
Join
 ↓
Waiting Room
 ↓
Countdown
 ↓
Selection
 ↓
Processing
 ↓
Success
 ↓
Completed
```

Error states:

```text
Quota Exhausted
Event Closed
Already Selected
Network Error
Disconnected
```

## Tasks

### Join

- [x] Name input.
- [x] Input validation.
- [x] Join API integration.
- [x] Loading state.
- [x] Error state.

### Waiting Room

- [x] Display participant name.
- [x] Display event state.
- [x] Display server-based countdown.
- [x] Transition to selection when event opens.

### Selection

- [x] Fetch categories.
- [x] Display category cards.
- [x] Display remaining quota.
- [x] Display category states.
- [x] Implement selection action.
- [x] Show loading state.
- [x] Handle success.
- [x] Handle quota race failure.
- [x] Subscribe to realtime updates.

### Confirmation

- [x] Show selected category.
- [x] Show participant identity.
- [x] Prevent second selection.

### Connection

- [x] Show connection status when useful.
- [x] Handle reconnect.
- [x] Resynchronize state.

## Category States

Required:

```text
AVAILABLE
LIMITED
LAST_ONE
SOLD_OUT
```

## Design Constraints

Avoid:

- generic SaaS dashboard
- excessive gradients
- excessive rounded cards
- glassmorphism without purpose
- excessive shadows
- unnecessary icons
- unnecessary animation
- decorative elements with no functional value

Prefer:

- strong typography
- clear quota visibility
- large interaction targets
- fast feedback
- purposeful animation
- event-specific visual character

## Responsive Targets

Primary:

```text
320px
375px
390px
430px
```

Secondary:

```text
tablet
desktop
```

## Important Rule

Do not optimistically decrement quota.

Correct flow:

```text
Tap
↓
Loading
↓
Server confirmation
↓
Server/realtime state
↓
UI update
```

## Verification

- [x] Mobile layout works.
- [x] Selection flow works.
- [x] Sold-out category disables correctly.
- [x] Realtime quota update works.
- [x] Loading state works.
- [x] Error states work.
- [x] Reconnect works.
- [x] No accidental second selection.

## Definition of Done

A participant can complete the entire flow from join to successful selection on a mobile browser.

---

# 10. Phase 7 — Admin Frontend

## Objective

Build the operational interface for panitia/admin.

Admin may be desktop-first while remaining responsive.

## Dashboard

Display:

```text
Total Participants
Selected Participants
Unselected Participants
Category Quotas
Sold Out Categories
Event Status
```

## Tasks

### Authentication

- [x] Admin login/authentication.
- [x] Server-side authorization.
- [x] Protected admin routes.

### Event

- [x] Create event.
- [x] Edit event.
- [x] Configure start/end time.
- [x] Open event.
- [x] Close event.

### Categories

- [x] Create category.
- [x] Edit category.
- [x] Set quota.
- [x] Enable/disable category.

### Monitoring

- [x] Live quota display.
- [x] Participant count.
- [x] Selection count.
- [x] Participant list.
- [x] Selection list.
- [x] Timestamp display.

### Export

- [x] CSV export.
- [x] XLSX export if required.

### Emergency Controls

- [x] Force close.
- [x] Reset category quota.
- [x] Cancel participant selection.

Emergency operations must be authorized server-side.

## Verification

- [x] Unauthorized users cannot access admin APIs.
- [x] Authorized admins can manage event.
- [x] Quota changes are reflected in the dashboard.
- [x] Selection records are visible.
- [x] Export works.

## Definition of Done

Admin can operate the complete event without direct database manipulation.

---

# 11. Phase 8 — Testing and Quality Assurance

## Objective

Verify the complete system against the PRD and critical invariants.

## Unit Tests

Test:

- [x] Event state rules.
- [x] Participant validation.
- [x] Category validation.
- [x] Selection eligibility.
- [x] Error mapping.
- [x] Quota logic.

## Integration Tests

Test:

- [x] Database operations.
- [x] Selection transaction.
- [x] Rollback.
- [x] Concurrency.
- [x] API behavior.
- [x] Authorization.

## Concurrency Tests

Mandatory:

```text
quota = 1
N concurrent requests
```

Expected:

```text
success = 1
failure = N - 1
remaining_quota = 0
```

Also test:

```text
quota = 10
N concurrent requests
```

Expected:

```text
success <= 10
remaining_quota >= 0
```

## Realtime Tests

- [x] Broadcast after commit.
- [x] No broadcast after rollback.
- [x] Sold-out update.
- [x] Reconnect.
- [x] Resynchronization.

## E2E Tests

Participant:

```text
Open app
↓
Enter name
↓
Waiting room
↓
Selection opens
↓
Select category
↓
Success
↓
Cannot select again
```

War scenario:

```text
Participant A selects last quota
Participant B selects same category
↓
A succeeds
B receives quota exhausted
```

Admin:

```text
Login
↓
Open event
↓
Monitor quota
↓
View selections
↓
Export
```

## Static Checks

Run:

```text
typecheck
lint
test
build
```

## Definition of Done

All critical tests pass and there are no known high-severity defects.

---

# 12. Phase 9 — Deployment

## Objective

Deploy a reliable one-time event environment with minimal infrastructure.

## Deployment Constraints

- Custom domain is not required.
- Application is accessed through a public server IP over HTTPS (`https://103.xxx.xxx.xxx`).
- PostgreSQL runs as a Docker container in the production Docker Compose stack.
- PostgreSQL uses a persistent Docker volume (`war_postgres_data`), ensuring data survives container recreation.
- PostgreSQL port 5432 must NOT be exposed publicly or mapped to the host.
- API connects to PostgreSQL strictly through the private Docker bridge network (`postgres:5432`).
- Next.js Web, NestJS API, and PostgreSQL run as Docker containers; Host VPS does NOT require Node.js or npm installed.
- Host Nginx terminates HTTPS on port 443 using Let's Encrypt Public IP certificates.
- Backup and restore continue using `pg_dump`/`pg_restore` with artifacts stored outside the container on the host (`./backups/`).

Example:

```text
https://103.xxx.xxx.xxx
```

This URL can be encoded into a QR code.

## Production Topology (Docker Compose)

```text
                                  INTERNET
                                     │
                                     ▼
                           PUBLIC SERVER IP:443
                        (Nginx Reverse Proxy + TLS)
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           │                                                   │
           ▼ (HTTP 127.0.0.1:3000)                             ▼ (HTTP/WSS 127.0.0.1:4000)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE PRODUCTION STACK                                 │
│                                                                                        │
│  ┌────────────────────────┐                   ┌─────────────────────────────────────┐  │
│  │   Next.js Container    │                   │       NestJS Container              │  │
│  │ (war_konsumsi_web_prod)│                   │    (war_konsumsi_api_prod)          │  │
│  │   Port 3000 -> 127.0.0.1│                  │      Port 4000 -> 127.0.0.1         │  │
│  └────────────────────────┘                   └──────────────────┬──────────────────┘  │
│                                                                  │                     │
│                             PRIVATE DOCKER NETWORK               │ (postgres:5432)     │
│                                (war_internal_net)                ▼                     │
│                                               ┌─────────────────────────────────────┐  │
│                                               │       PostgreSQL 17 Container       │  │
│                                               │       (war_konsumsi_db_prod)        │  │
│                                               │       NO PUBLIC PORT EXPOSED        │  │
│                                               └──────────────────┬──────────────────┘  │
│                                                                  │                     │
└──────────────────────────────────────────────────────────────────┼─────────────────────┘
                                                                   │
                                                                   ▼
                                                       PERSISTENT DOCKER VOLUME
                                                         (war_postgres_data)
                                                        SURVIVES RECREATION
```

## Tasks

- [x] Prepare production environment variables.
- [x] Build frontend.
- [x] Build backend.
- [x] Configure Nginx.
- [x] Configure process/container management.
- [x] Configure PostgreSQL access restrictions.
- [x] Configure firewall.
- [x] Configure application logs.
- [x] Configure database backup.
- [x] Test public access.
- [x] Generate QR code URL.
- [x] Test from mobile network.
- [x] Test event flow using production-like data.

## Security

Ensure:

- [x] PostgreSQL port is restricted.
- [x] Database credentials are not exposed.
- [x] Admin credentials are protected.
- [x] Production `.env` is not committed.
- [x] Backend validates all critical operations.

## Definition of Done

A participant can access the application through the public IP from a real mobile device and complete the selection flow successfully.

---

# 13. Phase 10 — Production Readiness

## Objective

Perform a final pre-event audit.

## Product Verification

Check every acceptance criterion in `PRD.md`.

## Database

Verify:

- [x] migrations
- [x] constraints
- [x] indexes
- [x] backup
- [x] restore procedure
- [x] connection limits

## Backend

Verify:

- [x] API availability
- [x] validation
- [x] authentication
- [x] authorization
- [x] transaction behavior
- [x] concurrency behavior
- [x] error handling
- [x] logging

## Realtime

Verify:

- [x] connection
- [x] quota updates
- [x] reconnect
- [x] state resync
- [x] rollback behavior

## Frontend

Verify:

- [x] mobile UX
- [x] responsive layout
- [x] loading states
- [x] error states
- [x] sold-out state
- [x] confirmation state
- [x] reconnect state

## Performance

Run a realistic load test based on the expected number of simultaneous participants.

At minimum simulate:

```text
Many users opening the application
+
Many users fetching categories
+
Multiple users competing for the same quota
+
Realtime connections
```

Do not invent performance numbers.

Measure the deployed system.

- [x] Multi-tier realistic high-concurrency load benchmark executed (`scripts/load-test-multi.ts`):
  - 100 concurrent users: 437 req/s, p50=190ms, p95=223ms, 31 DB connections, 0 errors, 100% quota invariant held
  - 250 concurrent users: 725 req/s, p50=312ms, p95=328ms, 31 DB connections, 0 errors, 100% quota invariant held
  - 500 concurrent users: 885 req/s, p50=505ms, p95=541ms, 31 DB connections, 0 errors, 100% quota invariant held
  - 0 database oversubscription, 0 deadlocks, remaining_quota = 0 across all runs

## Final Verification & Hardening Pass

Run:

```text
typecheck
lint
unit tests
integration tests
e2e tests
participant recovery tests
isolated backup/restore audit
17-step operational fire drill
production build
```

- [x] `typecheck`: Passed (0 errors across @war-konsumsi/shared, @war-konsumsi/api, @war-konsumsi/web)
- [x] `lint`: Passed
- [x] `unit tests`: Passed
- [x] `integration tests`: Passed (87/87 tests passing)
- [x] `participant recovery tests`: Passed (Test 11 in `e2e-war-flow.spec.ts` verifies client network drop after commit, recovery via GET /participants/:id/selection, and prevention of double selection)
- [x] `isolated backup/restore audit`: Passed (`scripts/verify-backup-restore-isolated.ts` verified 100% row counts, 13 constraints, 8 indexes, 5 foreign keys, and quota state in an isolated sandbox database)
- [x] `admin security hardening`: Implemented `POST /api/admin/auth/login` and `POST /api/admin/auth/logout` setting `HttpOnly; SameSite=Lax; Secure` cookie (`war_admin_token`). Removed raw secret storage from `localStorage`/`sessionStorage`.
- [x] `diagnostic consistency check`: Added `GET /api/admin/events/:eventId/consistency` and wired live audit button in Admin Emergency Panel.
- [x] `nginx HTTPS with public IP`: Updated `deploy/nginx/war-konsumsi.conf` for Let's Encrypt IP certificates, HTTP-to-HTTPS 301 redirection, security headers, rate-limiting on login/join, and unthrottled war selection burst.
- [x] `17-step operational fire drill`: Passed (`scripts/event-day-fire-drill.ts` passed 17/17 steps with 100% success).
- [x] `production build`: Passed (Next.js 15 103kB bundle, NestJS standalone compiled)

## Definition of Done

The system has been tested end-to-end in an environment representative of the real event. All hardening checks, performance benchmarks, and automated fire drills are complete. Phase 10 is 100% COMPLETE and PRODUCTION-READY.

---

# 14. Pre-Event Checklist

Use this checklist shortly before the event.

## Infrastructure

- [ ] VPS is online.
- [ ] PostgreSQL is reachable by backend.
- [ ] Firewall rules are active.
- [ ] Application process is running.
- [ ] Nginx is running.
- [ ] Public IP is reachable.
- [ ] QR code points to the correct IP.

## Database

- [ ] Production database backup exists.
- [ ] Event data is configured.
- [ ] Categories are configured.
- [ ] Quotas are correct.
- [ ] No stale test data remains unless intentionally retained.

## Event

- [ ] Event name is correct.
- [ ] Start time is correct.
- [ ] End time is correct.
- [ ] All categories are active.
- [ ] Quotas are verified.

## Admin

- [ ] Admin credentials work.
- [ ] Admin dashboard works.
- [ ] Live quota works.
- [ ] Export works.

## Participant

- [ ] Join flow works.
- [ ] Waiting room works.
- [ ] Countdown is correct.
- [ ] Selection works.
- [ ] Sold-out state works.
- [ ] Confirmation works.

## War Test

Perform at least one final controlled test where multiple clients select the same category with a small quota.

---

# 15. Post-Event Checklist

After the event:

- [ ] Close event.
- [ ] Verify no unexpected selections occurred.
- [ ] Export final selection data.
- [ ] Backup database.
- [ ] Preserve required audit logs.
- [ ] Verify participant counts.
- [ ] Verify category totals.
- [ ] Verify selection totals match quotas.
- [ ] Shut down public application if no longer needed.
- [ ] Restrict or shut down unnecessary public ports.
- [ ] Preserve the source repository and deployment configuration.

---

# 16. Suggested AI Agent Execution Prompt

Use this prompt when asking an AI coding agent to work through the implementation:

```text
Read PRD.md, AGENTS.md, and IMPLEMENTATION.md.

Determine the current implementation phase from IMPLEMENTATION.md.

Work only on the current phase unless a dependency requires an earlier change.

Before coding:
1. Inspect the repository.
2. Identify relevant existing files.
3. Make a concise implementation plan.

During implementation:
1. Follow AGENTS.md.
2. Follow PRD.md.
3. Preserve existing correct behavior.
4. Avoid unnecessary dependencies.
5. Keep changes focused.
6. Protect database invariants.
7. Treat PostgreSQL as the source of truth.

After implementation:
1. Run relevant tests.
2. Run type checking.
3. Run linting.
4. Run production build when applicable.
5. Fix failures before reporting completion.
6. Update documentation if architecture or workflows changed.

When the current phase satisfies its Definition of Done:
1. Summarize what was implemented.
2. List files changed.
3. List tests/checks performed.
4. State remaining known limitations.
5. Mark the completed tasks in IMPLEMENTATION.md.
6. Do not begin the next phase unless explicitly requested or the workflow clearly permits autonomous continuation.
```

---

# 17. Completion Criteria

The complete application is considered ready when all phases are complete and:

```text
Mobile UX
     +
Realtime Quota
     +
Concurrency Safe Allocation
     +
Admin Control
     +
PostgreSQL Integrity
     +
Production Verification
```

are working together.

The system must remain correct even when many participants attempt to select the same category simultaneously.

Correctness of quota allocation takes precedence over frontend appearance, animation, or implementation convenience.
