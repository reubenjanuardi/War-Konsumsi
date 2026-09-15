# Consumption War Selection System (War Konsumsi)

A mobile-first web application for real-time meal/consumption category selection with constrained quotas during live events.

---

## 🚀 Overview

The system is engineered specifically for high-concurrency one-time live events:
- **Mobile-First UX:** Optimized for attendees selecting meals via smartphone browsers (320px–430px viewports).
- **Concurrency-Safe Quota Allocation:** Atomic SQL-level quota decrementing guarantees zero oversubscription (`remaining_quota >= 0`) and strictly one selection per participant.
- **PostgreSQL Native Authority:** PostgreSQL running natively on the VPS is the authoritative source of truth for event state, category quotas, and selection records.
- **Post-Commit Realtime:** Socket.IO WebSocket broadcasts push quota status updates (`AVAILABLE`, `LIMITED`, `LAST_ONE`, `SOLD_OUT`) strictly after database transactions commit.
- **Single Public IP Deployment:** Direct access via public server IP (e.g. `http://103.xxx.xxx.xxx`) encoded into a physical QR code—no custom domain required.

---

## 📁 Monorepo Structure

```text
War-Konsumsi/
├── apps/
│   ├── api/                     # NestJS backend application & Socket.IO gateway (Port 4000)
│   └── web/                     # Next.js 15 App Router frontend (Port 3000)
├── packages/
│   └── shared/                  # Shared TypeScript types, enums, DTOs, and constants
├── deploy/                      # Production deployment configurations
│   ├── nginx/
│   │   ├── war-konsumsi.conf    # Nginx reverse proxy configuration for host
│   │   └── docker-nginx.conf    # Nginx reverse proxy configuration for Docker
│   ├── pm2/
│   │   └── ecosystem.config.cjs # PM2 process manager configuration
│   ├── postgres/
│   │   ├── postgresql.conf.snippet # PostgreSQL hardening & connection tuning
│   │   └── pg_hba.conf.snippet     # PostgreSQL authentication & IP restriction
│   ├── scripts/
│   │   ├── setup-ufw-firewall.sh   # Automated UFW firewall hardening script
│   │   ├── backup-db.sh / .ps1     # Automated compressed database backup script
│   │   └── restore-db.sh / .ps1    # Safe database restoration script
│   └── docker/
│       ├── Dockerfile.api       # Multi-stage production container for API
│       └── Dockerfile.web       # Multi-stage production container for Web
├── docs/
│   └── architecture.md          # Approved system architecture document
├── docker-compose.yml           # Local dev helper for PostgreSQL
├── docker-compose.prod.yml      # Optional production Docker Compose stack
├── package.json                 # Root npm workspaces configuration
├── .env.example                 # Local development environment template
├── .env.production.example      # Production environment template
├── IMPLEMENTATION.md            # Phased implementation tracking
└── README.md
```

---

## 🛠️ Prerequisites

### Production VPS Host:
- **Docker Engine:** `>= 24.x`
- **Docker Compose:** `>= 2.20.x`
- **Nginx:** Host reverse proxy and TLS termination
- **Certbot:** `>= 5.4` (for Let's Encrypt Public IP address certificates)
- *Note: Host VPS does NOT require Node.js, npm, PM2, or PostgreSQL installed.*

### Local Development Machine:
- **Node.js:** `>= 20.x` (Recommended: Node 22+ or 24 LTS)
- **npm:** `>= 10.x` (Recommended: npm 11+)
- **PostgreSQL:** Local PostgreSQL 17 or Docker Compose helper

---

## ⚙️ Local Development Setup

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd War-Konsumsi
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Ensure `DATABASE_URL` matches your local PostgreSQL credentials:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/war_konsumsi
PORT=4000
WEB_PORT=3000
```

### 3. Start PostgreSQL

#### Option A: Native PostgreSQL (Laragon / Windows Service)
If using Laragon, ensure PostgreSQL is running:
```powershell
& "C:\laragon\bin\postgresql\postgresql-17.10\bin\postgres.exe" -D "C:\laragon\data\postgresql-17"
```
Ensure the database `war_konsumsi` exists:
```sql
CREATE DATABASE war_konsumsi;
```

#### Option B: Docker Compose (Local Dev Helper)
```bash
docker compose up -d
```

### 4. Build Shared Package & Run Database Migrations

```bash
npm run build --workspace=@war-konsumsi/shared
npm run db:migrate --workspace=@war-konsumsi/api
npm run db:seed --workspace=@war-konsumsi/api
```

### 5. Run Development Servers

```bash
# Starts both API (0.0.0.0:4000) and Web (0.0.0.0:3000) concurrently:
npm run dev
```

Visit:
- Participant UI: `http://localhost:3000` (or `http://<LAN_IP>:3000` on mobile)
- Admin Portal: `http://localhost:3000/admin` (Default secret: `admin-master-secret-change-me`)
- API Health Check: `http://localhost:4000/api/health`

---

## 🌐 Production Deployment Guide (Single VPS with Docker Compose)

This guide deploys the application on an Ubuntu 22.04 / 24.04 LTS VPS accessed directly via its Public Server IP over HTTPS (e.g. `https://103.xxx.xxx.xxx`).

### Production Architecture

```text
                                  INTERNET
                                     │
                                     ▼
                           PUBLIC SERVER IP:443
                        (Host Nginx + Certbot TLS)
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

---

### Step 1: VPS Host Preparation

Log in to your VPS as root or sudo user:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx certbot
```

Install Docker & Docker Compose:
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```
*(Log out and back in, or run `newgrp docker` to refresh group permissions).*

> [!NOTE]
> The host VPS does **NOT** require Node.js, npm, PM2, or PostgreSQL installed. All runtimes are cleanly encapsulated inside Docker containers.

---

### Step 2: Clone Repository & Configure Environment

1. **Clone repository:**
```bash
cd /var/www
sudo git clone <your-repo-url> war-konsumsi
sudo chown -R $USER:$USER /var/www/war-konsumsi
cd /var/www/war-konsumsi
```

2. **Configure production environment:**
```bash
cp .env.production.example .env
nano .env
```

Ensure production values are configured:
```env
NODE_ENV=production
PORT=4000
WEB_PORT=3000
APP_URL=https://103.xxx.xxx.xxx
API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SOCKET_URL=

# PostgreSQL Database Credentials (used by Docker Compose postgres service)
POSTGRES_DB=war_konsumsi
POSTGRES_USER=war_app_user
POSTGRES_PASSWORD=YOUR_VERY_STRONG_DB_PASSWORD

# PostgreSQL Database Connection URL (used by API container via internal Docker DNS)
DATABASE_URL=postgres://war_app_user:YOUR_VERY_STRONG_DB_PASSWORD@postgres:5432/war_konsumsi
DATABASE_POOL_MAX=40

JWT_SECRET=YOUR_64_CHAR_RANDOM_SECRET
ADMIN_SECRET=YOUR_SECURE_ADMIN_PASSKEY
```

---

### Step 3: Launch Docker Compose Production Stack

Build and start all 3 services (`postgres`, `api`, `web`) in detached mode:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Verify that all containers are healthy and running:
```bash
docker compose -f docker-compose.prod.yml ps
```

---

### Step 4: Run Database Migrations & Initial Seed

Execute migrations and the default event seed inside the running API container:
```bash
# Run Drizzle migrations
docker compose -f docker-compose.prod.yml exec api npm run db:migrate --workspace=@war-konsumsi/api

# Seed initial event & categories
docker compose -f docker-compose.prod.yml exec api npm run db:seed --workspace=@war-konsumsi/api
```

---

### Step 5: Nginx Reverse Proxy Configuration

1. **Copy Nginx configuration:**
```bash
sudo cp deploy/nginx/war-konsumsi.conf /etc/nginx/sites-available/war-konsumsi
sudo ln -sf /etc/nginx/sites-available/war-konsumsi /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

2. **Obtain Let's Encrypt Public IP Certificate (No Custom Domain Required):**
Let's Encrypt supports publicly trusted IP address certificates using the short-lived profile.
```bash
# Create certbot webroot directory
sudo mkdir -p /var/www/certbot

# Obtain certificate directly for your VPS Public IP:
sudo certbot certonly --webroot -w /var/www/certbot \
  -d <YOUR_PUBLIC_IP> --agree-tos -m admin@example.com --non-interactive

# Configure automated renewal with Nginx reload hook:
echo "0 0 * * * root certbot renew --deploy-hook 'systemctl reload nginx'" | sudo tee /etc/cron.d/certbot-ip-renew
```

3. **Update Certificate Paths & Reload Nginx:**
In `/etc/nginx/sites-available/war-konsumsi`, verify that the SSL certificate paths point to your public IP:
```nginx
ssl_certificate /etc/letsencrypt/live/<YOUR_PUBLIC_IP>/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/<YOUR_PUBLIC_IP>/privkey.pem;
```
Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Now, all HTTP traffic on port 80 is automatically redirected (301) to HTTPS on port 443:
- `https://<PUBLIC_IP>/` routes to Next.js frontend
- `https://<PUBLIC_IP>/admin` routes to Next.js admin operations portal
- `https://<PUBLIC_IP>/api/` routes to NestJS REST API
- `https://<PUBLIC_IP>/socket.io/` routes to NestJS WebSocket (WSS with Upgrade headers)

> [!TIP]
> **Admin Authentication & Transport Security:**
> Administrative endpoints are authenticated server-side using an **`HttpOnly; SameSite=Lax; Secure` cookie (`war_admin_token`)** issued via `POST /api/admin/auth/login`. Sensitive secrets are **NEVER stored in `localStorage` or `sessionStorage`**. All admin traffic is strictly encrypted under TLS.
>
> **Participant Identity Boundary:**
> Attendees register with their name, receiving a server-generated UUID stored in client `localStorage`. As `localStorage` is not a cryptographic boundary, clearing storage or opening incognito creates a new identity. Event organizers should cross-reference the exported attendee CSV against physical registration rosters.
>
> **Realtime Delivery Semantics:**
> Realtime WebSocket broadcasts (`category.quota.updated`) provide **best-effort propagation, NOT guaranteed delivery**. Mobile devices that drop cellular packets or disconnect will not maintain stale state because the frontend automatically resynchronizes authoritative quota data from PostgreSQL upon reconnect or page load.

---

### Step 6: Firewall Hardening (UFW)

Run the included automated firewall configuration script:
```bash
sudo bash deploy/scripts/setup-ufw-firewall.sh
```

Or execute manually:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'Nginx HTTP'
sudo ufw allow 443/tcp comment 'Nginx HTTPS'
sudo ufw deny 5432/tcp comment 'Block External PostgreSQL'
sudo ufw deny 4000/tcp comment 'Block External NestJS Backend'
sudo ufw deny 3000/tcp comment 'Block External Next.js Frontend'
sudo ufw --force enable
sudo ufw status verbose
```

---

### Step 7: Database Backup & Restore Automation

#### Automated Backups
The script `deploy/scripts/backup-db.sh` produces compressed `pg_dump -Fc` archives in `./backups/` and automatically cleans up archives older than 7 days:

```bash
# Run manual backup:
bash deploy/scripts/backup-db.sh
```

To schedule hourly automated backups on event day, add to cron (`crontab -e`):
```cron
0 * * * * /bin/bash /var/www/war-konsumsi/deploy/scripts/backup-db.sh >> /var/log/war-konsumsi-backup.log 2>&1
```

#### Safe Database Restoration
To restore a snapshot:
```bash
bash deploy/scripts/restore-db.sh ./backups/war_konsumsi_backup_YYYYMMDD_HHMMSS.dump
```

---

## 🎯 Pre-Event Verification Checklist

Execute these checks before opening the selection event:

- [ ] **Public Connectivity:** Visit `https://103.xxx.xxx.xxx` from an external 4G/5G mobile connection (HTTPS must load with valid certificate).
- [ ] **QR Code Verification:** Generate a QR code pointing to `https://103.xxx.xxx.xxx` and scan with iOS and Android camera apps.
- [ ] **Health Check:** Query `https://103.xxx.xxx.xxx/api/health` — response must be `status: "ok"` and `database: "connected"`.
- [ ] **Admin Authentication:** Log into `https://103.xxx.xxx.xxx/admin` using `ADMIN_SECRET` (verifying secure HttpOnly cookie).
- [ ] **Event Configuration:** Verify event dates, category list, initial quotas, and description.
- [ ] **Firewall Check:** Verify `nmap -p 5432 103.xxx.xxx.xxx` reports the PostgreSQL port as `filtered` or `closed` (not reachable).
- [ ] **War Simulation:** Perform a final controlled test with 2–3 devices selecting the same category with `quota = 1` to ensure exactly one winner and instant sold-out UI update.
- [ ] **Clean Seed / Reset:** Reset category quotas or seed clean event data prior to live attendee entry.
- [ ] **Backup Verified:** Verify at least one fresh `.dump` file exists in `./backups/` outside the database container.

---

## 🧪 Available Scripts Summary

| Command | Description |
| :--- | :--- |
| `npm run build` | Builds all workspaces (`@war-konsumsi/shared`, `@war-konsumsi/api`, `@war-konsumsi/web`). |
| `npm run typecheck` | Runs TypeScript compiler checks across all workspaces without emitting output. |
| `npm run lint` | Runs lint checks across all workspaces. |
| `npm run test` | Executes unit and integration tests (Vitest). |
| `npm run dev` | Starts NestJS API and Next.js concurrently for development. |
| `docker compose -f docker-compose.prod.yml up -d --build` | Builds and launches production containers (`postgres`, `api`, `web`). |
| `docker compose -f docker-compose.prod.yml exec api npm run db:migrate --workspace=@war-konsumsi/api` | Executes database migrations inside API container. |
| `npx tsx scripts/event-day-fire-drill.ts` | Executes 17-step end-to-end operational fire drill testing full event lifecycle. |
| `npx tsx scripts/load-test-multi.ts` | Runs multi-tier concurrent war load benchmark (100, 250, 500 users). |
| `npx tsx scripts/verify-backup-restore-isolated.ts` | Verifies PostgreSQL backup and restoration in an isolated sandbox database. |
| `bash deploy/scripts/backup-db.sh` | Executes automated database backup via container streaming to host `./backups/`. |
| `bash deploy/scripts/restore-db.sh <file>` | Restores a database snapshot safely via Docker container. |
| `bash deploy/scripts/setup-ufw-firewall.sh` | Configures and hardens VPS firewall. |

---

## 📖 Architecture & Documentation References

- [PRD.md](PRD.md) — Product requirements, user journeys, and acceptance criteria.
- [AGENTS.md](AGENTS.md) — Engineering invariants, concurrency safety rules, and tech constraints.
- [IMPLEMENTATION.md](IMPLEMENTATION.md) — Sequenced implementation phases, gap analysis, and checklists.
- [docs/architecture.md](docs/architecture.md) — System architecture, ERD, selection transaction flow, and deployment topology.
