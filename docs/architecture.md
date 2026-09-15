# System Architecture — Consumption War Selection System

**Document Version:** 2.0  
**Status:** Phase 10 Hardened & Production-Ready  
**Target Environment:** Mobile-First Web Application on Native VPS  
**Primary Access:** Public Server IP over HTTPS (Let's Encrypt Public IP Certificate)

---

## 1. Executive Summary & Product Requirements Analysis

The **Consumption War Selection System** is an event-specific web application designed for the real-time selection of meal/consumption categories with constrained quotas. 

### 1.1 Core Business Mechanics
- **Simultaneous "War" Selection:** All attendees are held in a reactive waiting room with a synchronized countdown. At the moment selection opens, all participants can select a category concurrently.
- **Strict Quota Scarcity:** Quotas are limited and non-elastic. The system guarantees that a quota can never become negative, categories cannot be oversubscribed, and exactly one quota is allocated per successful selection.
- **Single Selection Invariant:** Each participant is permitted exactly one selection per event. Once confirmed, selections cannot be changed or submitted again by the participant.
- **Zero Optimistic Quota Assumption:** Clients must never optimistically decrement remaining quotas. State updates reflect only committed database transactions.

### 1.2 User Personas & Core Journeys
1. **Participant (Peserta):**
   - Scans QR code or opens `http://<VPS_IP>`.
   - Submits participant name (MVP identity).
   - Enters Waiting Room; views reactive countdown to `selection_starts_at`.
   - Transitions automatically to the Selection Screen when the server opens the event.
   - Observes live category quotas and urgency badges (`AVAILABLE`, `LIMITED`, `LAST_ONE`, `SOLD_OUT`).
   - Taps selection -> enters processing state -> receives instant confirmation or "Quota Habis" notification.
2. **Admin (Panitia):**
   - Authenticated administration panel.
   - Configures events, schedules, categories, and initial quotas.
   - Controls event state (`DRAFT` -> `WAITING` -> `OPEN` -> `CLOSED`).
   - Monitors live war statistics (active connections, quotas remaining, attendee selection status).
   - Executes emergency controls (force close, reset quota, cancel selection).
   - Exports final audit records to CSV/XLSX for physical distribution.

---

## 2. Engineering Constraints & Principles

In accordance with `AGENTS.md`, engineering decisions are strictly governed by this priority order:
1. **Correctness**
2. **Data Integrity**
3. **Concurrency Safety**
4. **Security**
5. **Reliability**
6. **User Experience**
7. **Performance**
8. **Maintainability**
9. **Developer Convenience**

### 2.1 Critical Invariants
```text
remaining_quota >= 0
successful_selections <= initial_quota
one participant = one selection per event
browser != direct database access
realtime != source of truth
frontend != authorization
client state != quota authority
postgres:5432 != public exposure (isolated on private Docker network)
container recreation != data loss (persistent Docker volume: war_postgres_data)
```

### 2.2 Source of Truth
- **PostgreSQL 17 Container (Mandatory Source of Truth):** PostgreSQL running in a dedicated Docker container (`postgres:17-alpine`) with a persistent Docker volume (`war_postgres_data`) on a private Docker bridge network (`war_internal_net`) is the **only authoritative source of truth**.
- Port `5432` is strictly internal to Docker and never exposed to the host or internet.
- The browser and frontend frameworks are strictly presentation layers.
- Real-time communication (Socket.IO) is purely for state propagation, never for state determination. Clients must always treat server responses and database state as authoritative.
- Server system clock (`now()`) is authoritative. Client-side clocks are ignored for eligibility validation.

---

## 3. Current Repository Inspection & Implementation Phase

### 3.1 Repository Inspection
- **Working Directory:** `C:\laragon\www\War-Konsumsi`
- **Source Code Present:** Full monorepo implemented (`apps/web`, `apps/api`, `packages/shared`).
- **Environment & Runtimes Available:**
  - Node.js `v24.12.0`
  - npm `11.14.1`
  - PostgreSQL 17 (production containerized in Docker Compose `postgres:17-alpine`)
  - Docker & Docker Compose
  - Git: Initialized repository on `main` branch

### 3.2 Current Implementation Phase
- Current Phase: **Production Hardening & Deployment Architecture Refinement**.
- Target: Full containerized production deployment ready for execution.

---

## 4. Technology Stack Specification

| Tier | Technology | Rationale & Selection Criteria |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS** | Mobile-first responsiveness, zero hydration bloat, fast load times (<= 2s over mobile networks), high tactile design control. Containerized via multi-stage Docker build. |
| **Backend** | **NestJS + TypeScript** | Enterprise modularity, native WebSocket Gateway support, clean separation of domain services, robust transaction decorators, built-in validation pipes (`class-validator`). Containerized via multi-stage Docker build. |
| **Database** | **PostgreSQL 17 in Docker (Docker Compose)** | Strict ACID compliance, atomic update capabilities, row-level locking, check constraints, sub-millisecond query performance. Backed by persistent named Docker volume (`war_postgres_data`). |
| **Database Access (ORM)** | **Drizzle ORM + postgres.js** | Thin, high-performance abstraction with full raw SQL expression support (`sql` template tags), zero overhead query building, native transaction support (`db.transaction`), and automated migration tooling (`drizzle-kit`). |
| **Realtime** | **Socket.IO (via @nestjs/platform-socket.io)** | Robust fallback transport (long-polling if mobile carrier drops WebSocket), native room support, automatic reconnection management, and lightweight footprint. |
| **Monorepo Tooling** | **npm Workspaces** | Native to Node.js v24 and npm 11; avoids additional global dependency overhead (pnpm/yarn), runs cleanly inside Docker containers. |
| **Reverse Proxy / Ingress** | **Nginx (Host)** | Public TLS/HTTPS termination on Public Server IP using Let's Encrypt Public IP certificates, proxying `/api` and `/socket.io` to NestJS container (127.0.0.1:4000), and proxying root web traffic to Next.js container (127.0.0.1:3000). |
| **Process Management** | **Docker Compose Native (restart: always)** | Standard container lifecycle management. No PM2 inside containers; containers run application processes directly (`node`, `npx next start`). Host VPS requires no Node.js/npm installed. |

---

## 5. Project & Monorepo Structure

```text
War-Konsumsi/
├── docs/
│   ├── architecture.md             # This document
│   └── api-spec.md                 # API endpoints & payloads
├── apps/
│   ├── api/                        # NestJS Application
│   │   ├── src/
│   │   │   ├── common/             # Filters, guards, interceptors, decorators
│   │   │   │   ├── filters/        # Global HttpExceptionFilter (user-friendly messages)
│   │   │   │   ├── guards/         # AdminAuthGuard
│   │   │   │   └── interceptors/   # Logging & audit interceptor
│   │   │   ├── config/             # Environment validation (env.schema)
│   │   │   ├── database/           # Drizzle connection, schema definitions, migrations
│   │   │   │   ├── schema/         # events.ts, categories.ts, participants.ts, selections.ts
│   │   │   │   └── migrations/     # Generated SQL migration files
│   │   │   ├── modules/
│   │   │   │   ├── events/         # Event management & lifecycle state machine
│   │   │   │   ├── participants/   # Participant join & validation
│   │   │   │   ├── categories/     # Category CRUD & quota retrieval
│   │   │   │   ├── selections/     # Concurrency-safe atomic quota allocation service
│   │   │   │   ├── admin/          # Panitia admin dashboard, emergency controls, export
│   │   │   │   └── realtime/       # Socket.IO Gateway & broadcast events
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/                   # Unit, integration, and concurrency stress tests
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                        # Next.js Frontend Application
│       ├── src/
│       │   ├── app/            # App Router
│       │   │   ├── page.tsx        # Landing / Join Screen
│       │   │   ├── wait/           # Waiting Room with server countdown
│       │   │   ├── select/         # Realtime Selection Screen (Category Cards)
│       │   │   ├── success/        # Selection Confirmation & Ticket
│       │   │   └── admin/          # Admin Dashboard & Live Monitoring
│       │   ├── components/         # Mobile-first UI components
│       │   │   ├── CategoryCard.tsx
│       │   │   ├── CountdownTimer.tsx
│       │   │   ├── LiveQuotaBar.tsx
│       │   │   ├── StatusBadge.tsx
│       │   │   └── Toast.tsx
│       │   ├── hooks/              # useSocket, useCountdown, useSelectionWar
│       │   ├── lib/                # api client, socket instance, localStorage helpers
│       │   └── types/
│       ├── public/                 # Static event banners, icons
│       ├── tsconfig.json
│       ├── tailwind.config.ts
│       └── package.json
│
├── packages/
│   └── shared/                     # Shared contracts, schemas, enums, and types ONLY
│       │                           # (Business-critical quota logic remains strictly in backend & DB)
│       ├── src/
│       │   ├── constants.ts
│       │   ├── dtos.ts
│       │   ├── enums.ts
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── .env.example
├── package.json                    # Monorepo root package.json (workspaces)
├── AGENTS.md
├── PRD.md
├── IMPLEMENTATION.md
└── README.md
```

---

## 6. Database Architecture & Schema Design

### 6.1 Entity-Relationship Diagram (ERD)

```text
┌───────────────────────────┐         ┌───────────────────────────┐
│          events           │         │        participants       │
├───────────────────────────┤         ├───────────────────────────┤
│ id (PK, UUID)             │1       *│ id (PK, UUID)             │
│ name (varchar)            │─────────│ event_id (FK -> events.id)│
│ status (varchar)          │         │ name (varchar)            │
│ selection_starts_at (tstz)│         │ created_at (tstz)         │
│ selection_ends_at (tstz)  │         └─────────────┬─────────────┘
│ created_at (tstz)         │                       │
│ updated_at (tstz)         │                       │ 1
└─────────────┬─────────────┘                       │
              │ 1                                   │
              │                                     │
              │ *                                   │ *
┌─────────────┴─────────────┐         ┌─────────────┴─────────────┐
│        categories         │         │        selections         │
├───────────────────────────┤         ├───────────────────────────┤
│ id (PK, UUID)             │1       *│ id (PK, UUID)             │
│ event_id (FK -> events.id)│─────────│ event_id (FK -> events.id)│
│ name (varchar)            │         │ participant_id (FK, UNIQUE)│
│ description (text)        │         │ category_id (FK)          │
│ image_url (text)          │         │ selected_at (tstz)        │
│ quota (integer)           │         └───────────────────────────┘
│ remaining_quota (integer) │
│ is_active (boolean)       │
│ created_at (tstz)         │
│ updated_at (tstz)         │
└───────────────────────────┘
```

### 6.2 Table DDL Specifications & Invariant Constraints

```sql
-- 1. Events Table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'WAITING', 'OPEN', 'CLOSED')),
    selection_starts_at TIMESTAMPTZ NOT NULL,
    selection_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Participants Table
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_participants_event_id ON participants(event_id);

-- 3. Categories Table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    quota INTEGER NOT NULL CHECK (quota >= 0),
    remaining_quota INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_remaining_quota_positive CHECK (remaining_quota >= 0),
    CONSTRAINT chk_remaining_quota_lte_quota CHECK (remaining_quota <= quota)
);
CREATE INDEX idx_categories_event_active ON categories(event_id, is_active);

-- 4. Selections Table
CREATE TABLE selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_selections_event_participant UNIQUE (event_id, participant_id)
);
CREATE INDEX idx_selections_category_id ON selections(category_id);
```

### 6.3 Database Design Rules
- All primary keys use `gen_random_uuid()` to prevent enumeration attacks and client timing leaks.
- `chk_remaining_quota_positive` ensures the database strictly rejects any transaction that would result in `remaining_quota < 0`.
- `uq_selections_event_participant` enforces at the storage engine level that a participant can never have more than one selection record per event.

---

## 7. Selection Concurrency & Transaction Architecture

Selection is the most sensitive business operation. Under peak event conditions ("War"), dozens or hundreds of concurrent HTTP requests will hit the selection endpoint for the final quota.

### 7.1 Flawed vs. Correct Implementation

#### ❌ Flawed (Application-Level Check):
```text
tx.findCategory(id)
if remaining_quota > 0:
    tx.updateCategory(remaining_quota - 1)
    tx.createSelection(...)
```
*Vulnerability:* Two parallel transactions read `remaining_quota = 1`. Both proceed to update, decrementing the quota to -1 or oversubscribing.

#### ✅ Correct (Atomic Predicated SQL Decrement):
```sql
UPDATE categories
SET remaining_quota = remaining_quota - 1,
    updated_at = NOW()
WHERE id = :categoryId
  AND event_id = :eventId
  AND is_active = TRUE
  AND remaining_quota > 0
RETURNING remaining_quota;
```
*Guarantee:* PostgreSQL row-level locks on the target category row during the `UPDATE`. Exactly one concurrent transaction succeeds when `remaining_quota = 1`. All subsequent transactions see `remaining_quota = 0`, yielding 0 affected rows.

### 7.2 The Selection Transaction Execution Flow

```text
HTTP POST /api/events/:eventId/selections
  │
  ▼
SelectionService.executeSelection(eventId, participantId, categoryId)
  │
  ├─ 1. In-memory pre-validation (Fast Fail)
  │     - Check payload format
  │
  ├─ 2. BEGIN DATABASE TRANSACTION
  │     │
  │     ├─ A. Validate Event:
  │     │     SELECT status, selection_starts_at, selection_ends_at
  │     │     FROM events WHERE id = :eventId;
  │     │     ASSERT status == 'OPEN' AND NOW() >= selection_starts_at;
  │     │
  │     ├─ B. Validate Participant:
  │     │     SELECT id FROM participants 
  │     │     WHERE id = :participantId AND event_id = :eventId;
  │     │
  │     ├─ C. Validate Participant Not Selected:
  │     │     SELECT id FROM selections 
  │     │     WHERE event_id = :eventId AND participant_id = :participantId;
  │     │     IF EXISTS -> ROLLBACK & THROW ALREADY_SELECTED;
  │     │
  │     ├─ D. Atomic Quota Decrement:
  │     │     UPDATE categories 
  │     │     SET remaining_quota = remaining_quota - 1, updated_at = NOW()
  │     │     WHERE id = :categoryId AND event_id = :eventId 
  │     │       AND is_active = TRUE AND remaining_quota > 0
  │     │     RETURNING remaining_quota;
  │     │     IF affected_rows == 0 -> ROLLBACK & THROW QUOTA_EXHAUSTED;
  │     │
  │     ├─ E. Insert Selection Record:
  │     │     INSERT INTO selections (id, event_id, participant_id, category_id, selected_at)
  │     │     VALUES (gen_random_uuid(), :eventId, :participantId, :categoryId, NOW());
  │     │
  │     └─ F. COMMIT TRANSACTION
  │
  ├─ 3. Post-Commit Execution (Outside DB Transaction):
  │     │
  │     ├─ Emit Real-Time Broadcast:
  │     │     socketGateway.broadcastQuotaUpdate(eventId, {
  │     │       categoryId,
  │     │       remainingQuota,
  │     │       status: remainingQuota === 0 ? 'SOLD_OUT' : 'AVAILABLE'
  │     │     });
  │     │
  │     └─ Return HTTP 201 Response to Winning Participant:
  │           { success: true, selection: { categoryId, categoryName, ... } }
  │
  └─ 4. On Error / Rollback:
        Translate error to user-friendly response (HTTP 409 / 400).
        NO realtime event emitted.
```

### 7.3 Participant State Recovery & Re-entrant Selection Integrity
Mobile networks frequently drop connection during or immediately after request execution. A critical scenario arises when a participant's selection transaction successfully commits on PostgreSQL, but the HTTP response is lost in transit before reaching the mobile client.
- **Explicit State Recovery Requirement:** If the selection response is lost due to network failure and the participant reloads the page or re-enters the app:
  1. The client initializes and immediately queries `GET /api/events/:eventId/participants/:participantId/selection`.
  2. The server detects the existing selection record created during the earlier committed transaction.
  3. The client receives the confirmed selection details and automatically renders the existing result / confirmation ticket view.
  4. The participant is strictly prevented from submitting a second selection, and no duplicate quota can ever be allocated.
- **Database Guarantee:** The unique composite constraint `UNIQUE (event_id, participant_id)` guarantees that even if a mobile client automatically retries the `POST /api/events/:eventId/selections` request upon network interruption, the database prevents a duplicate row and the backend returns the existing confirmed selection or an `ALREADY_SELECTED` status.

---

## 8. Realtime Architecture & Synchronization Protocol

### 8.1 Gateway Topology
- **Server:** NestJS WebSocket Gateway mounted on `/socket.io`.
- **Rooms:** Clients join channel `event:${eventId}` upon connecting.
- **Events Published:**
  - `category.quota.updated`: `{ categoryId: string, remainingQuota: number, status: 'AVAILABLE' | 'LIMITED' | 'LAST_ONE' | 'SOLD_OUT' }`
  - `event.status.updated`: `{ eventId: string, status: 'WAITING' | 'OPEN' | 'CLOSED' }`

### 8.2 Realtime Delivery Rules
1. **Never Broadcast Pre-Commit:** Socket emissions must strictly execute after `tx.commit()`. If the transaction rolls back due to a constraint or network failure, zero socket packets are emitted.
2. **Propagation Only (Not Source of Truth):** Realtime events are purely for state propagation. They must never be treated as authoritative, nor can they determine quota allocation or selection validity.
3. **Mandatory Client Resynchronization:** Clients must resynchronize from the server after reconnect, missed events, or stale state. Local client state is always superseded by direct HTTP query to PostgreSQL.

### 8.3 Network Resilience & State Resynchronization
Mobile devices frequently drop connection or experience latency spikes. The frontend must implement an automatic state resynchronization protocol:

```text
                    [Client Connected]
                            │
              (Network Drop / Cellular blip)
                            │
                            ▼
                    [State: DISCONNECTED]
               UI displays subtle badge:
            "Menghubungkan kembali..."
                            │
                   (Socket.IO reconnects)
                            │
                            ▼
                     [Event: CONNECT]
                            │
              Fetch Authoritative Server State:
         1. GET /api/events/:eventId/categories
         2. GET /api/events/:eventId/participants/:participantId/selection
                            │
                            ▼
              Re-hydrate local React state
             (Replaces any missed broadcasts)
                            │
                            ▼
                    [State: SYNCHRONIZED]
```

---

## 9. Frontend Mobile-First UX Architecture

### 9.1 Layout & Visual Density Principles (Anti-Generic / Anti-Slop)
Following `AGENTS.md` and `PRD.md`:
- **No Generic AI SaaS Templates:** Avoid gratuitous glassmorphism, floating colorful blurred orbs, excessive cards inside cards, and redundant animated stat counters.
- **Urgency & Clarity:** High information density optimized for single-hand mobile usage (screen widths: 320px, 375px, 390px, 430px).
- **Quota Badge States:**
  - `AVAILABLE` (Quota > 3): Standard high-contrast badge (e.g. `12 tersisa`).
  - `LIMITED` (1 < Quota <= 3): High-visibility warning indicator (e.g. `⚠ 2 tersisa`).
  - `LAST_ONE` (Quota = 1): High-urgency accent (e.g. `🔥 1 TERSISA — PILIH SEKARANG`).
  - `SOLD_OUT` (Quota = 0): Muted, strike-through styling, action disabled (`HABIS`).

### 9.2 UI State Machine for Participant Flow

```text
[Join Screen] ──(Input valid name)──► [Waiting Room]
                                            │
                                  (Countdown reaches 0 /
                                   Server opens event)
                                            │
                                            ▼
[Selection Screen] ◄──(Socket update)─── [Listening]
        │
    (Tap Category)
        │
        ▼
 [Processing State] (Button spinner, all category buttons locked)
        │
   ┌────┴──────────────────────────┐
   ▼                               ▼
[Success]                       [Failure: Quota Habis]
Shows ticket & selected food    Toast: "Kategori baru saja habis.
Locks client permanently        Pilih konsumsi lainnya."
                                Unlocks remaining available buttons
```

---

## 10. Deployment & Infrastructure Architecture

### 10.1 Topology Overview
The application is designed for a one-time event with zero unnecessary infrastructure. Custom domain is not required; direct public VPS IP with HTTPS is standard.

**Deployment Strategy:**
- **Docker Compose Stack on Single VPS:** Next.js Web, NestJS API, and PostgreSQL 17 all run as isolated containers defined in `docker-compose.prod.yml`.
- **Host Nginx Reverse Proxy:** Nginx runs on the host VPS to terminate HTTPS (Port 443) using Let's Encrypt Public IP certificates, route incoming requests, and redirect HTTP (Port 80) to HTTPS.
- **Zero Host Node.js/npm Requirement:** The VPS host does NOT require Node.js, npm, PM2, or PostgreSQL installed. All runtimes and dependencies are encapsulated inside Docker containers.
- **Architectural Decoupling:** While running on a single VPS for the event, each tier is completely decoupled. API communicates with PostgreSQL strictly through Docker internal DNS (`postgres:5432`).

```text
                            PUBLIC INTERNET
                                   │
                                   ▼
                   [ VPS PUBLIC IP:443 (HTTPS) ]
                                   │
                     [ Host Nginx Reverse Proxy ]
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

### 10.2 Network & VPS Security
- **PostgreSQL Isolation (Mandatory):** PostgreSQL runs in Docker container `war_konsumsi_db_prod`. Port `5432` is NOT exposed to the host interface or public internet (`ports:` is intentionally omitted in `docker-compose.prod.yml`). The API container connects strictly through the private Docker bridge network (`war_internal_net`). Direct browser-to-database connections are strictly prohibited.
- **Data Persistence & Container Recreation:** PostgreSQL uses named volume `war_postgres_data` mapped to `/var/lib/postgresql/data`. Database state is stored on the VPS host disk and persists safely through container restarts, stops, and image rebuilds.
- **Database Migrations:** Schema migrations are applied via the API container using:
  ```bash
  docker compose -f docker-compose.prod.yml exec api npm run db:migrate --workspace=@war-konsumsi/api
  ```
- **Backup & Restore Strategy:** Backup and restore continue using standard `pg_dump` and `pg_restore`. Executed via `docker exec` in `deploy/scripts/backup-db.sh` and `restore-db.sh`, dumping output directly into `./backups/` on the VPS host filesystem (completely outside the container).
- **Admin Authentication Transport Security (Mandatory Production Requirement):** Admin credentials and session tokens are protected by HTTPS encryption terminated by Host Nginx using Let's Encrypt Public IP Certificate (Certbot 5.4+). Plain HTTP on port 80 is permanently redirected (301) to HTTPS.
- **Realtime Delivery Semantics (Best-Effort Propagation):** Realtime WebSocket broadcasts (`category.quota.updated`, `event.status.updated`) provide **best-effort propagation, NOT guaranteed delivery**. Mobile networks may drop frames or disconnect during handoffs. The PostgreSQL database is the sole authoritative source of truth. The application guarantees correctness by enforcing that client state is never authoritative and that clients immediately re-fetch the latest database state upon reconnect or page load.
- **Nginx Ingress Configuration:**
  - Proxies HTTP/HTTPS traffic to Next.js (`http://127.0.0.1:3000`).
  - Proxies REST API to NestJS (`http://127.0.0.1:4000/api`).
  - Proxies WebSocket requests (`/socket.io`) with `Upgrade $http_upgrade` and `Connection "upgrade"` headers.
- **Environment Isolation:** Secrets (`DATABASE_URL`, `JWT_SECRET`, `ADMIN_SECRET`, `POSTGRES_PASSWORD`) remain in local `.env` files on the server and are never committed to version control.

---

## 11. Concurrency Risks & Mitigations Matrix

| Potential Risk | Root Cause | Architectural Mitigation |
| :--- | :--- | :--- |
| **Oversubscription (Quota < 0)** | Concurrent threads checking quota in memory before decrementing. | Database-level `UPDATE ... WHERE remaining_quota > 0` + `CHECK (remaining_quota >= 0)`. |
| **Double Selection by Participant** | Rapid double-clicking or scripted parallel HTTP requests. | Unique composite constraint `UNIQUE (event_id, participant_id)` in PostgreSQL. |
| **Lost HTTP Response Recovery** | Network drops after transaction commit before client receives 201 response. | Reconnect/refresh calls `GET /participants/:id/selection` to retrieve committed selection; second attempt rejected with `ALREADY_SELECTED`. |
| **Client Clock Tampering** | Attendee changing mobile device clock to bypass countdown. | Server enforces `NOW() >= selection_starts_at` and event status `OPEN` inside the transaction. |
| **Realtime Stale Ghost Quota** | Dropped packets during cellular handoff or network congestion. | Automatic client resynchronization (`fetchCategories()`) immediately upon socket reconnection. Realtime events are propagation only; client resynchronizes from server on reconnect. |
| **Database Pool Starvation** | Hundreds of simultaneous transactions holding locks too long. | Keep transactions minimal: pure SQL operations only; zero external HTTP or socket calls inside `db.transaction()`. Tune connection pool empirically via load testing. |
| **Premature Broadcast on Rollback** | Emitting websocket events before database transaction resolves. | Event dispatch occurs strictly in post-commit handlers. |

---

## 12. Technical Decisions & Architectural Records (ADRs)

1. **Package Management:** Native `npm workspaces` over pnpm/yarn. Zero bootstrap overhead, consistent CLI scripts across monorepo.
2. **Database Access Layer:** **Drizzle ORM** with `postgres.js` driver. Complete control over atomic SQL transactions (`UPDATE ... WHERE remaining_quota > 0 RETURNING ...`), lightweight footprint, type-safe schema and migrations.
3. **Realtime Transport:** **Socket.IO**. Realtime events are best-effort propagation only. PostgreSQL is the sole authoritative source of truth. Reconnection immediately resynchronizes state from database.
4. **Participant Identity Strategy:** Name-based entry returning a server-generated UUID `participantId` stored in client `localStorage`. Documented as an **accepted operational risk** for one-time event simplicity. The committee cross-references final CSV export rosters at food distribution.
5. **Admin Access Control & Transport Security:**
   - Transport: Direct HTTPS using Public Server IP with Let's Encrypt Public IP address certificate (Certbot 5.4+ short-lived profile). No custom domain required.
   - Authentication: Server-side `HttpOnly; SameSite=Lax; Secure` session cookie (`war_admin_token`). Raw secret is NEVER stored in `localStorage` or `sessionStorage`. Backward-compatible with `x-admin-secret` / `Authorization: Bearer` for scripts.
6. **Concurrency Protection:**
   - Atomic selection query in a PostgreSQL `SERIALIZABLE` or properly isolated transaction.
   - Database check constraint `CHECK (remaining_quota >= 0)` guarantees no oversubscription.
   - Unique composite constraint `UNIQUE (event_id, participant_id)` prevents double selection.
   - Nginx explicitly DOES NOT rate-limit `/api/events/:eventId/selections` to accommodate 500+ req/s legitimate war bursts.
7. **Production Consistency Diagnostic:**
   - Endpoint: `GET /api/admin/events/:eventId/consistency`.
   - Mathematically verifies that for every category: `initial_quota - selection_count = remaining_quota`, `remaining_quota >= 0`, and total selections equal distinct participants.
8. **Automated Verification:**
   - 17-step operational fire drill script (`scripts/event-day-fire-drill.ts`) testing complete event lifecycle.
   - Isolated backup and restore verification (`scripts/verify-backup-restore-isolated.ts`).
   - Multi-tier load benchmark (`scripts/load-test-multi.ts`) validating 100, 250, and 500 concurrent users.
9. **Containerized Production Topology (Docker Compose):**
   - PostgreSQL 17, NestJS API, and Next.js Web are packaged and orchestrated via `docker-compose.prod.yml`.
   - PostgreSQL runs with a dedicated persistent named volume (`war_postgres_data`), ensuring complete data survival across container restarts or teardowns.
   - Private bridge network (`war_internal_net`) guarantees database port 5432 is strictly unexposed to the VPS host and internet.
   - Host Nginx provides TLS termination directly on the Public Server IP without requiring a custom domain.
   - The host VPS remains clean with zero requirement for Node.js, npm, PM2, or native PostgreSQL.
   - Database migrations are executed via the API container, and backups/restores run via `docker exec` streaming to/from host disk `./backups/`.

---

## 13. Production Verification & Load Benchmark Results

The system was benchmarked under real contention against scarce `quota = 1`:

| Concurrent Users | Burst Duration | Throughput | Median Latency (p50) | 95th Percentile (p95) | DB Connections | Node.js RSS | Oversubscription | Invariant Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **100** | 229ms | 437 req/s | 190ms | 223ms | 31 | 106 MB | 0 | **100% PASSED** |
| **250** | 345ms | 725 req/s | 312ms | 328ms | 31 | 143 MB | 0 | **100% PASSED** |
| **500** | 565ms | 885 req/s | 505ms | 541ms | 31 | 181 MB | 0 | **100% PASSED** |

**Zero-oversubscription guarantee:** In every test tier, exactly 1 participant succeeded, all other concurrent requests were rejected with `QUOTA_EXHAUSTED` (HTTP 409), and database quota remained exactly 0.

---

## 14. Event-Day Readiness Status

**Current System Status:** **PRODUCTION-READY**
- All 10 phases completed and verified.
- 87 automated unit/integration/concurrency tests passing.
- 17/17 fire drill steps passing.
- Isolated database restore verified without data corruption.
- Clean production builds passing for API, Shared, and Web.
