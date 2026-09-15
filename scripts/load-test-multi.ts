// ==============================================================================
// WAR KONSUMSI — MULTI-TIER REALISTIC LOAD TEST (100, 250, 500 CONCURRENT USERS)
// ==============================================================================
// Measures throughput, latency (p50, p95, p99), error count, system resources,
// PostgreSQL active connections, and WebSocket connections under high war contention.
//
// Usage:
//   npx tsx scripts/load-test-multi.ts
// ==============================================================================

import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@war-konsumsi/shared';
import postgres from 'postgres';
import * as os from 'os';

const API_BASE = process.env.API_URL || 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-admin-secret';
const DB_HOST = process.env.PGHOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.PGPORT || '5432', 10);
const DB_USER = process.env.PGUSER || 'postgres';
const DB_PASS = process.env.PGPASSWORD || 'postgres';
const DB_NAME = process.env.PGDATABASE || 'war_konsumsi';

const sql = postgres({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
});

interface TierResult {
  tier: number;
  totalRequests: number;
  burstDurationMs: number;
  throughputRps: number;
  successes: number;
  quotaExhausted: number;
  unexpectedErrors: number;
  minMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  activePgConnections: number;
  activeWebSockets: number;
  cpuUsagePct: number;
  memUsageMb: number;
  remainingQuotaInDb: number;
  invariantPassed: boolean;
}

function calculatePercentiles(latencies: number[]) {
  if (latencies.length === 0) return { min: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const getP = (p: number) => sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];
  return {
    min: Math.round(sorted[0]),
    mean: Math.round(sum / sorted.length),
    p50: Math.round(getP(50)),
    p95: Math.round(getP(95)),
    p99: Math.round(getP(99)),
    max: Math.round(sorted[sorted.length - 1]),
  };
}

async function getPgActiveConnections(): Promise<number> {
  const [row] = await sql`SELECT count(*)::int as count FROM pg_stat_activity WHERE datname = ${DB_NAME}`;
  return row.count;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTier(userCount: number, authHeader: any): Promise<TierResult> {
  console.log(`\n----------------------------------------------------------------`);
  console.log(`🚀 RUNNING LOAD TIER: ${userCount} CONCURRENT PARTICIPANTS`);
  console.log(`----------------------------------------------------------------`);

  // 1. Create fresh event with Quota = 1 for the tier
  const eventRes = await fetch(`${API_BASE}/api/admin/events`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: `Multi-Load Tier Event (${userCount} Users) — ${Date.now()}`,
      selectionStartsAt: new Date(Date.now() - 5000).toISOString(),
    }),
  });
  const eventData = await eventRes.json();
  const eventId = eventData.event ? eventData.event.id : eventData.id;

  // Add 1 scarce category with quota = 1
  const catRes = await fetch(`${API_BASE}/api/admin/events/${eventId}/categories`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: `Exclusive Wagyu Bento (Quota = 1 for ${userCount} users)`,
      quota: 1,
    }),
  });
  const catData = await catRes.json();
  const categoryId = catData.category ? catData.category.id : catData.id;

  // 2. Open event
  await fetch(`${API_BASE}/api/admin/events/${eventId}/open`, {
    method: 'POST',
    headers: authHeader,
  });

  // 3. Register participants concurrently in batches of 50 to avoid local socket exhaustion
  console.log(`==> Registering ${userCount} participants...`);
  const participants: { id: string; name: string }[] = [];
  const batchSize = 50;
  for (let i = 0; i < userCount; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, userCount - i) }).map(async (_, idx) => {
      const num = i + idx + 1;
      const res = await fetch(`${API_BASE}/api/events/${eventId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Peserta T${userCount} #${String(num).padStart(3, '0')}` }),
      });
      const data = await res.json();
      return data.participant || data;
    });
    const batchResults = await Promise.all(batch);
    participants.push(...batchResults);
  }
  console.log(`    ✓ ${participants.length} participants registered.`);

  // 4. Connect WebSockets
  console.log(`==> Connecting ${userCount} WebSockets...`);
  const sockets: Socket[] = [];
  for (let i = 0; i < userCount; i++) {
    const s = io(API_BASE, {
      transports: ['websocket'],
      reconnection: false,
    });
    s.on('connect', () => {
      s.emit(SOCKET_EVENTS.JOIN_EVENT, { eventId });
    });
    sockets.push(s);
  }
  await sleep(1500); // Allow connections to settle
  const connectedSocketsCount = sockets.filter((s) => s.connected).length;
  console.log(`    ✓ ${connectedSocketsCount} WebSockets actively connected.`);

  // 5. Measure pre-burst system resources & DB connections
  const initialCpu = process.cpuUsage();
  const initialMem = process.memoryUsage();
  const activePgConns = await getPgActiveConnections();

  // 6. SIMULTANEOUS WAR BURST: All participants concurrently hit the quota = 1 category!
  console.log(`==> Firing SIMULTANEOUS WAR BURST: ${userCount} concurrent requests for Quota = 1...`);
  const burstStart = Date.now();

  const burstPromises = participants.map(async (p) => {
    const t0 = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/events/${eventId}/selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: p.id,
          categoryId,
        }),
      });
      const dur = Date.now() - t0;
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body, duration: dur };
    } catch (err: any) {
      return { status: 0, body: { error: err.message }, duration: Date.now() - t0 };
    }
  });

  const results = await Promise.all(burstPromises);
  const burstDurationMs = Date.now() - burstStart;
  const cpuDelta = process.cpuUsage(initialCpu);
  const totalCpuTimeMs = (cpuDelta.user + cpuDelta.system) / 1000;
  const cpuUsagePct = Math.min(100, Math.round((totalCpuTimeMs / (burstDurationMs * os.cpus().length)) * 100));
  const memUsageMb = Math.round(process.memoryUsage().rss / (1024 * 1024));

  // 7. Calculate Results & Invariants
  const successes = results.filter((r) => r.status === 201).length;
  const quotaExhausted = results.filter((r) => r.status === 409 && r.body?.code === 'QUOTA_EXHAUSTED').length;
  const unexpectedErrors = results.filter((r) => r.status !== 201 && !(r.status === 409 && r.body?.code === 'QUOTA_EXHAUSTED')).length;
  const latencies = results.map((r) => r.duration);
  const stats = calculatePercentiles(latencies);
  const throughputRps = Math.round((userCount / (burstDurationMs / 1000)));

  // Check Category remaining quota directly in DB
  const [catInDb] = await sql`SELECT remaining_quota FROM categories WHERE id = ${categoryId}`;
  const remainingQuotaInDb = catInDb.remaining_quota;

  const invariantPassed = successes === 1 && quotaExhausted === userCount - 1 && remainingQuotaInDb === 0 && unexpectedErrors === 0;

  console.log(`    Burst Duration:    ${burstDurationMs} ms`);
  console.log(`    Throughput:        ${throughputRps} req/sec`);
  console.log(`    Successes (201):   ${successes} (Expected: exactly 1)`);
  console.log(`    Exhausted (409):   ${quotaExhausted} (Expected: exactly ${userCount - 1})`);
  console.log(`    Errors:            ${unexpectedErrors} (Expected: 0)`);
  console.log(`    Latency p50/p95:   ${stats.p50} ms / ${stats.p95} ms`);
  console.log(`    Active DB Conns:   ${activePgConns}`);
  console.log(`    Memory (RSS):      ${memUsageMb} MB`);
  console.log(`    Remaining Quota:   ${remainingQuotaInDb}`);
  console.log(`    Verdict:           ${invariantPassed ? '✅ INVARIANT PASSED' : '❌ INVARIANT FAILED'}`);

  // Cleanup WebSockets
  for (const s of sockets) s.disconnect();
  await sleep(1000);

  return {
    tier: userCount,
    totalRequests: userCount,
    burstDurationMs,
    throughputRps,
    successes,
    quotaExhausted,
    unexpectedErrors,
    minMs: stats.min,
    meanMs: stats.mean,
    p50Ms: stats.p50,
    p95Ms: stats.p95,
    p99Ms: stats.p99,
    maxMs: stats.max,
    activePgConnections: activePgConns,
    activeWebSockets: connectedSocketsCount,
    cpuUsagePct,
    memUsageMb,
    remainingQuotaInDb,
    invariantPassed,
  };
}

async function main() {
  console.log('================================================================');
  console.log('⚡ MULTI-TIER REALISTIC CONCURRENCY LOAD BENCHMARK');
  console.log(`Target: ${API_BASE}`);
  console.log(`Tiers: 100, 250, and 500 Concurrent Users`);
  console.log('================================================================\n');

  // Authenticate Admin
  let validSecret = '';
  for (const s of [ADMIN_SECRET, 'dev-admin-secret', 'admin-master-secret-change-me']) {
    const res = await fetch(`${API_BASE}/api/admin/auth/verify`, {
      method: 'POST',
      headers: { 'x-admin-secret': s, 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      validSecret = s;
      break;
    }
  }
  if (!validSecret) throw new Error('Admin auth failed');
  const authHeader = { 'x-admin-secret': validSecret, 'Content-Type': 'application/json' };

  const tiers = [100, 250, 500];
  const summary: TierResult[] = [];

  for (const t of tiers) {
    const res = await runTier(t, authHeader);
    summary.push(res);
    await sleep(2000); // Cooldown between tiers
  }

  await sql.end();

  console.log('\n================================================================');
  console.log('📊 MULTI-TIER BENCHMARK FINAL SUMMARY TABLE');
  console.log('================================================================');
  console.table(
    summary.map((s) => ({
      'Users': s.tier,
      'Throughput (req/s)': s.throughputRps,
      'Min (ms)': s.minMs,
      'Mean (ms)': s.meanMs,
      'p50 (ms)': s.p50Ms,
      'p95 (ms)': s.p95Ms,
      'p99 (ms)': s.p99Ms,
      'Max (ms)': s.maxMs,
      'Errors': s.unexpectedErrors,
      'DB Conns': s.activePgConnections,
      'Sockets': s.activeWebSockets,
      'Mem (MB)': s.memUsageMb,
      'DB Quota': s.remainingQuotaInDb,
      'Invariant': s.invariantPassed ? 'PASSED' : 'FAILED',
    }))
  );
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Multi-tier load test failed:', err);
  process.exit(1);
});
