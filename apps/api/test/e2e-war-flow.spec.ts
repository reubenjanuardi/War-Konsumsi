import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { GlobalHttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DRIZZLE_DB, type DrizzleDB } from '../src/database/database.module.js';
import { events, categories, participants, selections } from '../src/database/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { EventStatus, CategoryStatus } from '@war-konsumsi/shared';
import { getEnvironmentConfig } from '../src/config/env.js';

describe('Phase 8: Comprehensive End-to-End & Invariant Test Suite', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  const config = getEnvironmentConfig();
  const adminSecret = config.adminSecret || 'admin-master-secret-change-me';

  // Event IDs for specific test contexts
  let waitingEventId: string;
  let openEventId: string;
  let closedEventId: string;

  // Category IDs
  let openSingleQuotaCatId: string;
  let openMultiQuotaCatId: string;
  let inactiveCatId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();

    db = moduleFixture.get<DrizzleDB>(DRIZZLE_DB);

    // 1. Create a WAITING event (Starts in future)
    const [wEv] = await db
      .insert(events)
      .values({
        name: 'E2E Waiting Gathering 2026',
        status: EventStatus.WAITING,
        selectionStartsAt: new Date(Date.now() + 3600 * 1000), // 1 hour future
      })
      .returning();
    waitingEventId = wEv.id;

    // 2. Create an OPEN event (Started now)
    const [oEv] = await db
      .insert(events)
      .values({
        name: 'E2E Open War Gathering 2026',
        status: EventStatus.OPEN,
        selectionStartsAt: new Date(Date.now() - 10000), // started 10s ago
      })
      .returning();
    openEventId = oEv.id;

    // 3. Create a CLOSED event
    const [cEv] = await db
      .insert(events)
      .values({
        name: 'E2E Closed Gathering 2026',
        status: EventStatus.CLOSED,
        selectionStartsAt: new Date(Date.now() - 7200 * 1000),
        selectionEndsAt: new Date(Date.now() - 3600 * 1000),
      })
      .returning();
    closedEventId = cEv.id;

    // Categories in OPEN event:
    // a. Single quota (quota = 1) for the last-quota war scenario
    const [singleCat] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'E2E Special Rendang (Quota 1)',
        quota: 1,
        remainingQuota: 1,
        isActive: true,
      })
      .returning();
    openSingleQuotaCatId = singleCat.id;

    // b. Multi quota (quota = 5)
    const [multiCat] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'E2E Nasi Liwet Komplit (Quota 5)',
        quota: 5,
        remainingQuota: 5,
        isActive: true,
      })
      .returning();
    openMultiQuotaCatId = multiCat.id;

    // c. Inactive category
    const [inactCat] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'E2E Inactive Secret Menu',
        quota: 10,
        remainingQuota: 10,
        isActive: false,
      })
      .returning();
    inactiveCatId = inactCat.id;
  });

  afterAll(async () => {
    // Cleanup created test events
    for (const eid of [waitingEventId, openEventId, closedEventId]) {
      if (eid) {
        await db.delete(events).where(eq(events.id, eid));
      }
    }
    await app.close();
  });

  // =========================================================================
  // Specific Test 1: One Participant = One Selection
  // =========================================================================
  describe('1. One participant = one selection invariant', () => {
    it('allows a participant to select once and strictly rejects a second selection with 409 ALREADY_SELECTED', async () => {
      // 1. Join event
      const joinRes = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/join`)
        .send({ name: 'Andi Peserta Satu' });
      expect(joinRes.status).toBe(201);
      const participantId = joinRes.body.participant.id;

      // 2. Select first meal
      const selectRes = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId,
          categoryId: openMultiQuotaCatId,
        });
      expect(selectRes.status).toBe(201);
      expect(selectRes.body.success).toBe(true);
      expect(selectRes.body.selection.categoryName).toBe('E2E Nasi Liwet Komplit (Quota 5)');

      // 3. Attempt second selection on another category
      const secondSelectRes = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId,
          categoryId: openMultiQuotaCatId,
        });
      expect(secondSelectRes.status).toBe(409);
      expect(secondSelectRes.body.success).toBe(false);
      expect(secondSelectRes.body.code).toBe('ALREADY_SELECTED');
      expect(secondSelectRes.body.message).toContain('sudah memiliki pilihan');

      // 4. Verify in database: exactly 1 selection row exists for this participant
      const participantSelections = await db
        .select()
        .from(selections)
        .where(
          and(
            eq(selections.eventId, openEventId),
            eq(selections.participantId, participantId),
          ),
        );
      expect(participantSelections).toHaveLength(1);
    });
  });

  // =========================================================================
  // Specific Test 2 & 3: Selection Never Exceeds Quota & Quota Never Negative
  // =========================================================================
  describe('2 & 3. Selection never exceeds quota and quota never becomes negative', () => {
    it('strictly caps selections at initial quota and guarantees remaining_quota >= 0', async () => {
      // Check current quota on openMultiQuotaCatId
      const [catBefore] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, openMultiQuotaCatId));
      const startingQuota = catBefore.remainingQuota; // Should be 4 now

      // Create startingQuota + 3 participants
      const excessParticipants = [];
      for (let i = 0; i < startingQuota + 3; i++) {
        const j = await request(app.getHttpServer())
          .post(`/api/events/${openEventId}/join`)
          .send({ name: `Quota Cap Participant ${i}` });
        excessParticipants.push(j.body.participant.id);
      }

      // Fire selection sequentially until exhausted and beyond
      const results = [];
      for (const pId of excessParticipants) {
        const res = await request(app.getHttpServer())
          .post(`/api/events/${openEventId}/selections`)
          .send({
            participantId: pId,
            categoryId: openMultiQuotaCatId,
          });
        results.push(res);
      }

      const successes = results.filter((r) => r.status === 201);
      const exhaustedFailures = results.filter(
        (r) => r.status === 409 && r.body.code === 'QUOTA_EXHAUSTED',
      );

      expect(successes).toHaveLength(startingQuota);
      expect(exhaustedFailures).toHaveLength(3);

      // Verify category in DB
      const [catAfter] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, openMultiQuotaCatId));
      expect(catAfter.remainingQuota).toBe(0);
      expect(catAfter.remainingQuota).toBeGreaterThanOrEqual(0);

      // Total selections for this category equals initial quota 5
      const allCategorySelections = await db
        .select()
        .from(selections)
        .where(eq(selections.categoryId, openMultiQuotaCatId));
      expect(allCategorySelections).toHaveLength(5);
    });
  });

  // =========================================================================
  // Specific Test 4: Concurrent Selection is Safe (War Scenario)
  // =========================================================================
  describe('4. Concurrent selection is safe (War scenario: Quota = 1, N concurrent users)', () => {
    it('produces exactly 1 winner and N-1 QUOTA_EXHAUSTED when 10 users hit a quota=1 category simultaneously', async () => {
      // Setup 10 participants
      const participantsList: string[] = [];
      for (let i = 0; i < 10; i++) {
        const j = await request(app.getHttpServer())
          .post(`/api/events/${openEventId}/join`)
          .send({ name: `Concurrent War Fighter ${i}` });
        participantsList.push(j.body.participant.id);
      }

      // Fire 10 simultaneous selection requests using Promise.all
      const requests = participantsList.map((pId) =>
        request(app.getHttpServer())
          .post(`/api/events/${openEventId}/selections`)
          .send({
            participantId: pId,
            categoryId: openSingleQuotaCatId,
          }),
      );

      const responses = await Promise.all(requests);

      const winners = responses.filter((r) => r.status === 201);
      const losers = responses.filter(
        (r) => r.status === 409 && r.body.code === 'QUOTA_EXHAUSTED',
      );

      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(9);

      // Verify DB state
      const [catFinal] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, openSingleQuotaCatId));
      expect(catFinal.remainingQuota).toBe(0);

      const dbSelections = await db
        .select()
        .from(selections)
        .where(eq(selections.categoryId, openSingleQuotaCatId));
      expect(dbSelections).toHaveLength(1);
    });
  });

  // =========================================================================
  // Specific Test 5 & 6: Realtime State Correctness & Reconnect Resynchronization
  // =========================================================================
  describe('5 & 6. Realtime state correctness and reconnect state recovery', () => {
    it('verifies category list reflects sold out status and recovery endpoint returns authoritative state', async () => {
      // 1. Fetch categories
      const catRes = await request(app.getHttpServer())
        .get(`/api/events/${openEventId}/categories`);
      expect(catRes.status).toBe(200);

      const singleCat = catRes.body.categories.find(
        (c: any) => c.id === openSingleQuotaCatId,
      );
      expect(singleCat.remainingQuota).toBe(0);
      expect(singleCat.status).toBe(CategoryStatus.SOLD_OUT);

      // 2. Simulate client reconnecting and resynchronizing participant selection
      const allSel = await db
        .select()
        .from(selections)
        .where(eq(selections.categoryId, openSingleQuotaCatId));
      const winnerId = allSel[0].participantId;

      const resyncRes = await request(app.getHttpServer())
        .get(`/api/events/${openEventId}/participants/${winnerId}/selection`);
      expect(resyncRes.status).toBe(200);
      expect(resyncRes.body.hasSelected).toBe(true);
      expect(resyncRes.body.selection.categoryId).toBe(openSingleQuotaCatId);
    });
  });

  // =========================================================================
  // Specific Test 7 & 8: Event Status Gate (Pre-OPEN and Post-CLOSED)
  // =========================================================================
  describe('7 & 8. Event selection gates before OPEN and after CLOSED', () => {
    it('strictly rejects selection when event is in WAITING state (7. Pre-OPEN)', async () => {
      // Create category in WAITING event
      const [wCat] = await db
        .insert(categories)
        .values({
          eventId: waitingEventId,
          name: 'Waiting Menu',
          quota: 10,
          remainingQuota: 10,
        })
        .returning();

      // Join waiting event
      const j = await request(app.getHttpServer())
        .post(`/api/events/${waitingEventId}/join`)
        .send({ name: 'Early Bird Participant' });
      const pId = j.body.participant.id;

      // Try selecting before OPEN
      const res = await request(app.getHttpServer())
        .post(`/api/events/${waitingEventId}/selections`)
        .send({
          participantId: pId,
          categoryId: wCat.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EVENT_NOT_OPEN');
      expect(res.body.message).toContain('Pemilihan belum dibuka');
    });

    it('strictly rejects selection when event is in CLOSED state (8. Post-CLOSED)', async () => {
      // Create category in CLOSED event
      const [cCat] = await db
        .insert(categories)
        .values({
          eventId: closedEventId,
          name: 'Closed Menu',
          quota: 10,
          remainingQuota: 10,
        })
        .returning();

      // Join closed event
      const j = await request(app.getHttpServer())
        .post(`/api/events/${closedEventId}/join`)
        .send({ name: 'Late Participant' });
      const pId = j.body.participant.id;

      // Try selecting after CLOSED
      const res = await request(app.getHttpServer())
        .post(`/api/events/${closedEventId}/selections`)
        .send({
          participantId: pId,
          categoryId: cCat.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EVENT_NOT_OPEN');
      expect(res.body.message).toContain('Pemilihan belum dibuka atau sudah ditutup');
    });

    it('strictly rejects selection on an inactive category even when event is OPEN', async () => {
      const j = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/join`)
        .send({ name: 'Inactive Menu Seeker' });
      const pId = j.body.participant.id;

      const res = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId: pId,
          categoryId: inactiveCatId,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CATEGORY_INACTIVE');
    });
  });

  // =========================================================================
  // Specific Test 9: Admin Authorization & Emergency Controls
  // =========================================================================
  describe('9. Admin authorization and emergency controls', () => {
    it('blocks unauthenticated operations and executes authorized emergency quota restore', async () => {
      // Unauthorized call
      const unauth = await request(app.getHttpServer())
        .get(`/api/admin/events/${openEventId}/dashboard`);
      expect(unauth.status).toBe(401);

      // Authorized call: Get dashboard
      const authDash = await request(app.getHttpServer())
        .get(`/api/admin/events/${openEventId}/dashboard`)
        .set('x-admin-secret', adminSecret);
      expect(authDash.status).toBe(200);
      expect(authDash.body.success).toBe(true);

      // Emergency: Cancel the single winner selection from Test 4
      const [selToCancel] = await db
        .select()
        .from(selections)
        .where(eq(selections.categoryId, openSingleQuotaCatId));
      expect(selToCancel).toBeDefined();

      const cancelRes = await request(app.getHttpServer())
        .delete(`/api/admin/events/${openEventId}/selections/${selToCancel.id}`)
        .set('x-admin-secret', adminSecret);
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.success).toBe(true);

      // Verify category quota was restored back to 1 in DB
      const [catRestored] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, openSingleQuotaCatId));
      expect(catRestored.remainingQuota).toBe(1);

      // Verify winner can now select again
      const retryRes = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId: selToCancel.participantId,
          categoryId: openSingleQuotaCatId,
        });
      expect(retryRes.status).toBe(201);
      expect(retryRes.body.success).toBe(true);
    });
  });

  // =========================================================================
  // Specific Test 10: Full Participant Lifecycle Simulation
  // =========================================================================
  describe('10. Full mobile participant flow simulation', () => {
    it('completes the entire end-to-end journey: join -> check event -> select -> verify ticket', async () => {
      // 1. Join event
      const joinRes = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/join`)
        .send({ name: 'Siti Full Journey' });
      expect(joinRes.status).toBe(201);
      const participantId = joinRes.body.participant.id;

      // Add a fresh category for the full journey test
      const [journeyCat] = await db
        .insert(categories)
        .values({
          eventId: openEventId,
          name: 'E2E Journey Special Bento',
          quota: 5,
          remainingQuota: 5,
          isActive: true,
        })
        .returning();

      // 2. Fetch active event detail
      const currentRes = await request(app.getHttpServer())
        .get(`/api/events/${openEventId}`);
      expect(currentRes.status).toBe(200);
      expect(currentRes.body.event.status).toBe(EventStatus.OPEN);

      // 3. Fetch categories
      const catRes = await request(app.getHttpServer())
        .get(`/api/events/${openEventId}/categories`);
      expect(catRes.status).toBe(200);
      const availableCategories = catRes.body.categories.filter(
        (c: any) => c.remainingQuota > 0 && c.isActive,
      );
      expect(availableCategories.length).toBeGreaterThanOrEqual(1);
      const chosenCat = availableCategories[0];

      // 4. Select category
      const selectRes = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId,
          categoryId: chosenCat.id,
        });
      expect(selectRes.status).toBe(201);
      expect(selectRes.body.selection.participantId).toBe(participantId);
      expect(selectRes.body.selection.categoryId).toBe(chosenCat.id);

      // 5. Verify participant confirmation state
      const checkRes = await request(app.getHttpServer())
        .get(`/api/events/${openEventId}/participants/${participantId}/selection`);
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.hasSelected).toBe(true);
      expect(checkRes.body.selection.categoryName).toBe(chosenCat.name);
    });

    it('11. Participant Recovery: when selection commits but client drops HTTP response, reconnect recovers selection and prevents second selection', async () => {
      // 1. Join event
      const joinRes = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/join`)
        .send({ name: 'Peserta Network Drop Recovery' });
      expect(joinRes.status).toBe(201);
      const participantId = joinRes.body.participant.id;

      // 2. Prepare a test category with quota 2
      const [recoveryCat] = await db
        .insert(categories)
        .values({
          eventId: openEventId,
          name: 'Recovery Test Meal',
          quota: 2,
          remainingQuota: 2,
          isActive: true,
        })
        .returning();

      // 3. Selection transaction executes and commits on server
      const selectRes = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId,
          categoryId: recoveryCat.id,
        });
      expect(selectRes.status).toBe(201);
      const committedSelectionId = selectRes.body.selection.id;

      // SIMULATE: Client network dropped before UI processed the HTTP 201 response.
      // 4. Participant reconnects / refreshes page and fetches authoritative server state:
      const recoverRes = await request(app.getHttpServer())
        .get(`/api/events/${openEventId}/participants/${participantId}/selection`);
      expect(recoverRes.status).toBe(200);
      expect(recoverRes.body.hasSelected).toBe(true);
      expect(recoverRes.body.selection).toBeDefined();
      expect(recoverRes.body.selection.id).toBe(committedSelectionId);
      expect(recoverRes.body.selection.categoryId).toBe(recoveryCat.id);
      expect(recoverRes.body.selection.categoryName).toBe('Recovery Test Meal');

      // 5. In case user / client script attempts to re-select or retry:
      const secondTryRes = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId,
          categoryId: recoveryCat.id,
        });
      expect(secondTryRes.status).toBe(409);
      expect(secondTryRes.body.code).toBe('ALREADY_SELECTED');

      // 6. Verify quota was decremented exactly once
      const [catAfter] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, recoveryCat.id));
      expect(catAfter.remainingQuota).toBe(1);

      // 7. Verify exactly 1 selection record exists in database
      const participantSelections = await db
        .select()
        .from(selections)
        .where(and(eq(selections.eventId, openEventId), eq(selections.participantId, participantId)));
      expect(participantSelections.length).toBe(1);
    });
  });
});
