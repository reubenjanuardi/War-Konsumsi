// ==============================================================================
// WAR KONSUMSI — 17-STEP EVENT-DAY OPERATIONAL FIRE DRILL
// ==============================================================================
// Executes an exhaustive, automated end-to-end smoke test validating the entire
// live event lifecycle from pre-flight checks to emergency closure and CSV export.
//
// Usage:
//   npx tsx scripts/event-day-fire-drill.ts
// ==============================================================================

import * as dotenv from 'dotenv';
dotenv.config();

import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@war-konsumsi/shared';

const API_BASE = process.env.API_URL ? process.env.API_URL.replace('0.0.0.0', 'localhost') : 'http://localhost:4000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-admin-secret';

interface StepResult {
  step: number;
  name: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

const results: StepResult[] = [];

function logStep(step: number, title: string) {
  console.log(`\n\x1b[34m[STEP ${step}/17]\x1b[0m \x1b[1m${title}\x1b[0m`);
}

function recordResult(step: number, name: string, passed: boolean, details: string, durationMs: number) {
  results.push({ step, name, passed, details, durationMs });
  if (passed) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m (${durationMs}ms): ${details}`);
  } else {
    console.log(`  \x1b[31m✘ FAIL\x1b[0m (${durationMs}ms): ${details}`);
  }
}

async function runFireDrill() {
  console.log('='.repeat(70));
  console.log('       WAR KONSUMSI — EVENT-DAY PRODUCTION FIRE DRILL (17 STEPS)');
  console.log('='.repeat(70));
  console.log(`Target API: ${API_BASE}`);
  console.log(`Start Time: ${new Date().toISOString()}`);

  let adminCookie = '';
  let eventId = '';
  let cat1Id = '';
  let cat2Id = '';
  let socket: Socket | null = null;
  const participantIds: string[] = [];
  let socketQuotaReceived: number | null = null;
  let socketStatusReceived: string | null = null;

  // ----------------------------------------------------------------------------
  // STEP 1: Pre-flight Telemetry & Health Check
  // ----------------------------------------------------------------------------
  {
    const stepNum = 1;
    logStep(stepNum, 'Pre-flight Telemetry & Health Verification');
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const data = await res.json();
      const passed = res.ok && data.status === 'ok' && data.database === 'connected';
      recordResult(
        stepNum,
        'API & Database Health',
        passed,
        `Status: ${data.status}, DB: ${data.database}, Uptime: ${data.uptimeSeconds}s`,
        Date.now() - start,
      );
      if (!passed) throw new Error('Health check failed');
    } catch (err: any) {
      recordResult(stepNum, 'API & Database Health', false, err.message, Date.now() - start);
      process.exit(1);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 2: Admin Authentication via HttpOnly Cookie
  // ----------------------------------------------------------------------------
  {
    const stepNum = 2;
    logStep(stepNum, 'Admin Authentication & HttpOnly Cookie Issuance');
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: ADMIN_SECRET }),
      });
      const data = await res.json();
      const getSetCookie = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [];
      const rawCookie = getSetCookie.length > 0 ? getSetCookie.join('; ') : (res.headers.get('set-cookie') || '');
      
      // Match war_admin_token=<val>
      const match = rawCookie.match(/war_admin_token=[^;]+/);
      adminCookie = match ? match[0] : '';

      const passed = res.ok && data.success === true && !!adminCookie;
      recordResult(
        stepNum,
        'Admin HttpOnly Cookie Login',
        passed,
        `Status: ${res.status}, Cookie: ${adminCookie ? adminCookie.slice(0, 25) + '...' : 'NONE'}, Raw: ${rawCookie.includes('HttpOnly') ? 'HttpOnly present' : 'Local env'}`,
        Date.now() - start,
      );
      if (!passed) throw new Error(`Admin login failed: HTTP ${res.status} - ${JSON.stringify(data)}`);
    } catch (err: any) {
      recordResult(stepNum, 'Admin HttpOnly Cookie Login', false, err.message, Date.now() - start);
      process.exit(1);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 3: Event Creation (Clean State)
  // ----------------------------------------------------------------------------
  {
    const stepNum = 3;
    logStep(stepNum, 'Event Initialization (WAITING / Waiting Room)');
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          name: `Fire Drill Event ${Date.now()}`,
          selectionStartsAt: new Date(Date.now() + 60000).toISOString(),
          status: 'WAITING',
        }),
      });
      const data = await res.json();
      eventId = data.event?.id;
      const passed = res.ok && data.success && eventId && data.event.status === 'WAITING';
      recordResult(
        stepNum,
        'Event Creation',
        passed,
        `Event ID: ${eventId}, Status: ${data.event?.status}`,
        Date.now() - start,
      );
      if (!passed) throw new Error(`Event creation failed: HTTP ${res.status} - ${JSON.stringify(data)}`);
    } catch (err: any) {
      recordResult(stepNum, 'Event Creation', false, err.message, Date.now() - start);
      process.exit(1);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 4: Category Setup with Limited Quotas
  // ----------------------------------------------------------------------------
  {
    const stepNum = 4;
    logStep(stepNum, 'Category Setup with Scarce Quotas');
    const start = Date.now();
    try {
      const res1 = await fetch(`${API_BASE}/api/admin/events/${eventId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: 'Paket Rendang Spesial', quota: 2 }),
      });
      const data1 = await res1.json();
      cat1Id = data1.category?.id;

      const res2 = await fetch(`${API_BASE}/api/admin/events/${eventId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: 'Paket Ayam Bakar', quota: 5 }),
      });
      const data2 = await res2.json();
      cat2Id = data2.category?.id;

      const passed = res1.ok && res2.ok && cat1Id && cat2Id && data1.category.remainingQuota === 2;
      recordResult(
        stepNum,
        'Category Setup',
        passed,
        `Cat 1 (Quota=2): ${cat1Id}, Cat 2 (Quota=5): ${cat2Id}`,
        Date.now() - start,
      );
      if (!passed) throw new Error('Category setup failed');
    } catch (err: any) {
      recordResult(stepNum, 'Category Setup', false, err.message, Date.now() - start);
      process.exit(1);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 5: Realtime Socket.IO Connection & Room Join
  // ----------------------------------------------------------------------------
  {
    const stepNum = 5;
    logStep(stepNum, 'Realtime Socket.IO Connection & Room Join');
    const start = Date.now();
    try {
      socket = io(API_BASE, {
        transports: ['websocket'],
        reconnection: false,
      });

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Socket.IO connection timeout')), 4000);
        socket!.on('connect', () => {
          clearTimeout(timer);
          socket!.emit(SOCKET_EVENTS.JOIN_EVENT, { eventId });
          resolve();
        });
        socket!.on('connect_error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      socket.on(SOCKET_EVENTS.CATEGORY_QUOTA_UPDATED, (payload: any) => {
        if (payload.categoryId === cat1Id) {
          socketQuotaReceived = payload.remainingQuota;
        }
      });

      socket.on(SOCKET_EVENTS.EVENT_STATUS_UPDATED, (payload: any) => {
        socketStatusReceived = payload.status;
      });

      recordResult(
        stepNum,
        'Realtime Connection',
        true,
        `Socket connected (id: ${socket.id}) & joined event_${eventId}`,
        Date.now() - start,
      );
    } catch (err: any) {
      recordResult(stepNum, 'Realtime Connection', false, err.message, Date.now() - start);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 6: Pre-Selection Invariant Verification (Before Event Opens)
  // ----------------------------------------------------------------------------
  {
    const stepNum = 6;
    logStep(stepNum, 'Pre-Selection Invariant Verification (Must Reject before OPEN)');
    const start = Date.now();
    try {
      // Register a temporary participant
      const pRes = await fetch(`${API_BASE}/api/events/${eventId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Early Bird Participant' }),
      });
      const pData = await pRes.json();
      const earlyParticipantId = pData.participant?.id;

      // Try selecting before event is OPEN
      const selRes = await fetch(`${API_BASE}/api/events/${eventId}/selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: earlyParticipantId, categoryId: cat1Id }),
      });
      const selData = await selRes.json();

      const passed = (selRes.status === 400 || selRes.status === 409) && selData.code === 'EVENT_NOT_OPEN';
      recordResult(
        stepNum,
        'Pre-Selection Invariant',
        passed,
        `Status: ${selRes.status} (Rejected as expected), Code: ${selData.code}`,
        Date.now() - start,
      );
    } catch (err: any) {
      recordResult(stepNum, 'Pre-Selection Invariant', false, err.message, Date.now() - start);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 7: Participant Registration (10 Participants)
  // ----------------------------------------------------------------------------
  {
    const stepNum = 7;
    logStep(stepNum, 'Registering 10 War Participants');
    const start = Date.now();
    try {
      const regPromises = Array.from({ length: 10 }).map(async (_, i) => {
        const res = await fetch(`${API_BASE}/api/events/${eventId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `Peserta Drill ${i + 1}` }),
        });
        const data = await res.json();
        return data.participant?.id;
      });

      const ids = await Promise.all(regPromises);
      ids.forEach((id) => id && participantIds.push(id));

      const passed = participantIds.length === 10;
      recordResult(
        stepNum,
        'Participant Registration',
        passed,
        `Registered ${participantIds.length} participants`,
        Date.now() - start,
      );
    } catch (err: any) {
      recordResult(stepNum, 'Participant Registration', false, err.message, Date.now() - start);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 8: Admin Event Open
  // ----------------------------------------------------------------------------
  {
    const stepNum = 8;
    logStep(stepNum, 'Admin Opens Event (Transition to OPEN)');
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/admin/events/${eventId}/open`, {
        method: 'POST',
        headers: { Cookie: adminCookie },
      });
      const data = await res.json();
      const passed = res.ok && data.success && data.event?.status === 'OPEN';
      recordResult(
        stepNum,
        'Admin Event Open',
        passed,
        `Event Status: ${data.event?.status}`,
        Date.now() - start,
      );
    } catch (err: any) {
      recordResult(stepNum, 'Admin Event Open', false, err.message, Date.now() - start);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 9: Realtime Status Broadcast Verification
  // ----------------------------------------------------------------------------
  {
    const stepNum = 9;
    logStep(stepNum, 'Realtime Event Status Broadcast Verification');
    const start = Date.now();
    // Wait up to 1 second for socket event
    let waited = 0;
    while (!socketStatusReceived && waited < 1000) {
      await new Promise((r) => setTimeout(r, 100));
      waited += 100;
    }
    const passed = socketStatusReceived === 'OPEN';
    recordResult(
      stepNum,
      'Realtime Status Propagation',
      passed,
      `Received WebSocket Status: ${socketStatusReceived}`,
      Date.now() - start,
    );
  }

  // ----------------------------------------------------------------------------
  // STEP 10: War Selection Burst Execution (10 concurrent requests for Quota = 2)
  // ----------------------------------------------------------------------------
  let winners: string[] = [];
  let exhaustedCount = 0;
  {
    const stepNum = 10;
    logStep(stepNum, 'Executing 10-User Concurrent War Burst on Quota = 2');
    const start = Date.now();
    try {
      const burstPromises = participantIds.map(async (pId) => {
        const res = await fetch(`${API_BASE}/api/events/${eventId}/selections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId: pId, categoryId: cat1Id }),
        });
        const data = await res.json();
        return { pId, status: res.status, code: data.code, data };
      });

      const burstResults = await Promise.all(burstPromises);
      winners = burstResults.filter((r) => r.status === 201).map((r) => r.pId);
      exhaustedCount = burstResults.filter((r) => r.status === 409 && r.code === 'QUOTA_EXHAUSTED').length;

      recordResult(
        stepNum,
        'War Burst Execution',
        true,
        `Executed in ${Date.now() - start}ms: ${winners.length} winners, ${exhaustedCount} exhausted`,
        Date.now() - start,
      );
    } catch (err: any) {
      recordResult(stepNum, 'War Burst Execution', false, err.message, Date.now() - start);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 11: Atomic Quota Decrement & Invariant Check
  // ----------------------------------------------------------------------------
  {
    const stepNum = 11;
    logStep(stepNum, 'Atomic Quota Integrity & Oversubscription Invariant Check');
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/events/${eventId}/categories`);
      const data = await res.json();
      const targetCat = data.categories?.find((c: any) => c.id === cat1Id);

      const passed =
        winners.length === 2 &&
        exhaustedCount === 8 &&
        targetCat?.remainingQuota === 0 &&
        targetCat?.status === 'SOLD_OUT';

      recordResult(
        stepNum,
        'Atomic Quota Invariant',
        passed,
        `Winners: ${winners.length} (Expected 2), Exhausted: ${exhaustedCount} (Expected 8), DB Remaining: ${targetCat?.remainingQuota}, Status: ${targetCat?.status}`,
        Date.now() - start,
      );
    } catch (err: any) {
      recordResult(stepNum, 'Atomic Quota Invariant', false, err.message, Date.now() - start);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 12: Sold-Out Category Rejection Verification
  // ----------------------------------------------------------------------------
  {
    const stepNum = 12;
    logStep(stepNum, 'Sold-Out Category Subsequent Rejection');
    const start = Date.now();
    try {
      // Unselected participant attempts to pick the sold-out category
      const nonWinnerId = participantIds.find((id) => !winners.includes(id))!;
      const res = await fetch(`${API_BASE}/api/events/${eventId}/selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: nonWinnerId, categoryId: cat1Id }),
      });
      const data = await res.json();
      const passed = res.status === 409 && data.code === 'QUOTA_EXHAUSTED';
      recordResult(
        stepNum,
        'Sold-Out Rejection',
        passed,
        `HTTP Status: ${res.status}, Code: ${data.code}`,
        Date.now() - start,
      );
    } catch (err: any) {
      recordResult(stepNum, 'Sold-Out Rejection', false, err.message, Date.now() - start);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 13: Double Selection Invariant Check (One Participant = One Selection)
  // ----------------------------------------------------------------------------
  {
    const stepNum = 13;
    logStep(stepNum, 'Double Selection Prevention Invariant');
    const start = Date.now();
    try {
      const winnerId = winners[0];
      // Winner tries to pick category 2 (which still has quota = 5)
      const res = await fetch(`${API_BASE}/api/events/${eventId}/selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: winnerId, categoryId: cat2Id }),
      });
      const data = await res.json();
      const passed = res.status === 409 && data.code === 'ALREADY_SELECTED';
      recordResult(
        stepNum,
        'Double Selection Prevention',
        passed,
        `HTTP Status: ${res.status}, Code: ${data.code}`,
        Date.now() - start,
      );
    } catch (err: any) {
      recordResult(stepNum, 'Double Selection Prevention', false, err.message, Date.now() - start);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 14: Participant Recovery (Network Drop Emulation)
  // ----------------------------------------------------------------------------
  {
    const stepNum = 14;
    logStep(stepNum, 'Participant Selection State Recovery');
    const start = Date.now();
    try {
      const winnerId = winners[0];
      const res = await fetch(`${API_BASE}/api/events/${eventId}/participants/${winnerId}/selection`);
      const data = await res.json();
      const passed = res.ok && data.success && data.selection?.categoryId === cat1Id;
      recordResult(
        stepNum,
        'State Recovery',
        passed,
        `Retrieved Selection: ${data.selection?.id}, Category: ${data.selection?.categoryName}`,
        Date.now() - start,
      );
    } catch (err: any) {
      recordResult(stepNum, 'State Recovery', false, err.message, Date.now() - start);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 15: Realtime Quota Synchronization Verification
  // ----------------------------------------------------------------------------
  {
    const stepNum = 15;
    logStep(stepNum, 'Realtime Quota Broadcast Reception Verification');
    const start = Date.now();
    let waited = 0;
    while (socketQuotaReceived === null && waited < 1000) {
      await new Promise((r) => setTimeout(r, 100));
      waited += 100;
    }
    const passed = socketQuotaReceived === 0;
    recordResult(
      stepNum,
      'Realtime Quota Sync',
      passed,
      `Socket received remainingQuota: ${socketQuotaReceived}`,
      Date.now() - start,
    );
  }

  // ----------------------------------------------------------------------------
  // STEP 16: Database Consistency Diagnostic Audit Endpoint
  // ----------------------------------------------------------------------------
  {
    const stepNum = 16;
    logStep(stepNum, 'PostgreSQL Mathematical Consistency Diagnostic Audit');
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/admin/events/${eventId}/consistency`, {
        headers: { Cookie: adminCookie },
      });
      const data = await res.json();
      const passed = res.ok && data.success && data.isConsistent === true && data.issues.length === 0;
      recordResult(
        stepNum,
        'Consistency Diagnostic Audit',
        passed,
        `isConsistent: ${data.isConsistent}, Issues: ${data.issues?.length}, Selections: ${data.summary?.totalSelections}, Remaining Quota: ${data.summary?.totalRemainingQuota}`,
        Date.now() - start,
      );
    } catch (err: any) {
      recordResult(stepNum, 'Consistency Diagnostic Audit', false, err.message, Date.now() - start);
    }
  }

  // ----------------------------------------------------------------------------
  // STEP 17: Event Close & CSV Data Export
  // ----------------------------------------------------------------------------
  {
    const stepNum = 17;
    logStep(stepNum, 'Event Close & CSV Data Export Verification');
    const start = Date.now();
    try {
      // 1. Close event
      const closeRes = await fetch(`${API_BASE}/api/admin/events/${eventId}/close`, {
        method: 'POST',
        headers: { Cookie: adminCookie },
      });
      const closeData = await closeRes.json();

      // 2. Export CSV
      const exportRes = await fetch(`${API_BASE}/api/admin/events/${eventId}/export`, {
        headers: { Cookie: adminCookie },
      });
      const rawBytes = new Uint8Array(await exportRes.arrayBuffer());
      const hasUtf8Bom = rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF;
      const csvText = new TextDecoder().decode(rawBytes);

      const passed =
        closeRes.ok &&
        closeData.event?.status === 'CLOSED' &&
        exportRes.ok &&
        exportRes.headers.get('content-type')?.includes('text/csv') &&
        hasUtf8Bom &&
        csvText.includes('SUDAH_MEMILIH');

      recordResult(
        stepNum,
        'Event Close & CSV Export',
        passed,
        `Status: ${closeData.event?.status}, CSV UTF-8 BOM: ${hasUtf8Bom} (0xEF,0xBB,0xBF), Rows: ${csvText.split('\n').length}`,
        Date.now() - start,
      );
    } catch (err: any) {
      recordResult(stepNum, 'Event Close & CSV Export', false, err.message, Date.now() - start);
    }
  }

  // Cleanup
  if (socket) socket.disconnect();

  // ----------------------------------------------------------------------------
  // Summary Report
  // ----------------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log('                 17-STEP FIRE DRILL EXECUTION REPORT');
  console.log('='.repeat(70));

  let allPassed = true;
  for (const r of results) {
    const statusStr = r.passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`Step ${String(r.step).padStart(2, ' ')}: [${statusStr}] ${r.name.padEnd(32, ' ')} (${r.durationMs}ms)`);
    if (!r.passed) allPassed = false;
  }

  console.log('='.repeat(70));
  if (allPassed) {
    console.log('  \x1b[32m\x1b[1mOVERALL RESULT: ALL 17 STEPS PASSED SUCCESSFULLY (100% SUCCESS)\x1b[0m');
    console.log('  The system is fully hardened and verified for live event operations.');
  } else {
    console.log('  \x1b[31m\x1b[1mOVERALL RESULT: SOME STEPS FAILED. CHECK LOGS ABOVE.\x1b[0m');
  }
  console.log('='.repeat(70) + '\n');

  process.exit(allPassed ? 0 : 1);
}

runFireDrill().catch((err) => {
  console.error('Fatal error during fire drill:', err);
  process.exit(1);
});
