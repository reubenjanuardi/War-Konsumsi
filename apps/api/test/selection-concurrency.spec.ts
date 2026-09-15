import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { GlobalHttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DRIZZLE_DB, type DrizzleDB } from '../src/database/database.module.js';
import { events, categories, participants, selections } from '../src/database/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import { EventStatus } from '@war-konsumsi/shared';

describe('Selection Concurrency Integration Tests', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  let openEventId: string;

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

    // Create an OPEN event for concurrency tests
    const [openEv] = await db
      .insert(events)
      .values({
        name: 'Concurrency War Test Event',
        status: EventStatus.OPEN,
        selectionStartsAt: new Date(Date.now() - 5000), // 5 seconds in past
      })
      .returning();
    openEventId = openEv.id;
  });

  afterAll(async () => {
    if (openEventId && db) {
      await db.delete(events).where(eq(events.id, openEventId));
    }
    await app.close();
  });

  // =========================================================================
  // Case 1: quota = 1 with 10 concurrent users
  // Expected: 1 success, 9 failures, quota = 0, exactly 1 selection in DB
  // =========================================================================
  it('Case 1: quota = 1, 10 concurrent users -> exactly 1 winner, 9 QUOTA_EXHAUSTED, quota = 0', async () => {
    // 1. Setup category with quota = 1
    const [category] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Case 1 - Rendang Terakhir',
        quota: 1,
        remainingQuota: 1,
        isActive: true,
      })
      .returning();

    // 2. Setup 10 distinct participants
    const participantValues = Array.from({ length: 10 }, (_, i) => ({
      eventId: openEventId,
      name: `User Case 1 - ${i + 1}`,
    }));
    const createdParticipants = await db.insert(participants).values(participantValues).returning();
    expect(createdParticipants.length).toBe(10);

    // 3. Fire 10 simultaneous selection requests
    const requests = createdParticipants.map((p) =>
      request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId: p.id,
          categoryId: category.id,
        }),
    );

    const responses = await Promise.all(requests);

    // 4. Evaluate responses
    const successes = responses.filter((res) => res.status === 201);
    const failures = responses.filter((res) => res.status === 409);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(9);

    // Verify successful response payload
    expect(successes[0].body.success).toBe(true);
    expect(successes[0].body.selection.categoryId).toBe(category.id);

    // Verify all failures returned QUOTA_EXHAUSTED
    for (const failure of failures) {
      expect(failure.body.success).toBe(false);
      expect(failure.body.code).toBe('QUOTA_EXHAUSTED');
    }

    // 5. Verify database integrity
    const [updatedCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, category.id));

    expect(updatedCategory.remainingQuota).toBe(0);

    const selectionRecords = await db
      .select()
      .from(selections)
      .where(eq(selections.categoryId, category.id));

    expect(selectionRecords.length).toBe(1);
    expect(selectionRecords[0].participantId).toBe(successes[0].body.selection.participantId);
  }, 30000);

  // =========================================================================
  // Case 2: quota = 10 with 50 concurrent users
  // Expected: 10 successes, 40 failures, quota = 0, exactly 10 selections in DB
  // =========================================================================
  it('Case 2: quota = 10, 50 concurrent users -> exactly 10 winners, 40 QUOTA_EXHAUSTED, quota = 0', async () => {
    // 1. Setup category with quota = 10
    const [category] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Case 2 - Ayam Goreng War',
        quota: 10,
        remainingQuota: 10,
        isActive: true,
      })
      .returning();

    // 2. Setup 50 distinct participants
    const participantValues = Array.from({ length: 50 }, (_, i) => ({
      eventId: openEventId,
      name: `User Case 2 - ${i + 1}`,
    }));
    const createdParticipants = await db.insert(participants).values(participantValues).returning();
    expect(createdParticipants.length).toBe(50);

    // 3. Fire 50 simultaneous selection requests
    const requests = createdParticipants.map((p) =>
      request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId: p.id,
          categoryId: category.id,
        }),
    );

    const responses = await Promise.all(requests);

    // 4. Evaluate responses
    const successes = responses.filter((res) => res.status === 201);
    const failures = responses.filter((res) => res.status === 409);

    expect(successes.length).toBe(10);
    expect(failures.length).toBe(40);

    // Verify all 40 failures are QUOTA_EXHAUSTED
    for (const failure of failures) {
      expect(failure.body.success).toBe(false);
      expect(failure.body.code).toBe('QUOTA_EXHAUSTED');
    }

    // 5. Verify database integrity
    const [updatedCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, category.id));

    expect(updatedCategory.remainingQuota).toBe(0);

    const selectionRecords = await db
      .select()
      .from(selections)
      .where(eq(selections.categoryId, category.id));

    expect(selectionRecords.length).toBe(10);

    // Verify all winning participants are unique
    const winningParticipantIds = new Set(selectionRecords.map((s) => s.participantId));
    expect(winningParticipantIds.size).toBe(10);
  }, 45000);

  // =========================================================================
  // Case 3: duplicate participant concurrent requests
  // Expected: exactly 1 selection, all others rejected with ALREADY_SELECTED
  // =========================================================================
  it('Case 3: duplicate participant concurrent requests -> exactly 1 selection, 4 ALREADY_SELECTED, quota decremented once', async () => {
    // 1. Setup category with quota = 5
    const [category] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Case 3 - Bebek Betutu',
        quota: 5,
        remainingQuota: 5,
        isActive: true,
      })
      .returning();

    // 2. Setup 1 participant
    const [participant] = await db
      .insert(participants)
      .values({
        eventId: openEventId,
        name: 'Aggressive Double Clicker',
      })
      .returning();

    // 3. Fire 5 simultaneous requests from the same participant
    const requests = Array.from({ length: 5 }, () =>
      request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId: participant.id,
          categoryId: category.id,
        }),
    );

    const responses = await Promise.all(requests);

    // 4. Evaluate responses
    const successes = responses.filter((res) => res.status === 201);
    const failures = responses.filter((res) => res.status === 409);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(4);

    for (const failure of failures) {
      expect(failure.body.success).toBe(false);
      expect(failure.body.code).toBe('ALREADY_SELECTED');
    }

    // 5. Verify database integrity
    const [updatedCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, category.id));

    // Quota must only be decremented by 1 (5 - 1 = 4)
    expect(updatedCategory.remainingQuota).toBe(4);

    const participantSelections = await db
      .select()
      .from(selections)
      .where(
        eq(selections.participantId, participant.id),
      );

    expect(participantSelections.length).toBe(1);
  }, 30000);

  // =========================================================================
  // Case 4: transaction failure rollback
  // Expected: quota and selection remain consistent (no partial state)
  // =========================================================================
  it('Case 4: transaction failure -> quota and selection remain consistent without partial state', async () => {
    // 1. Setup category with quota = 5
    const [category] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Case 4 - Rollback Test Item',
        quota: 5,
        remainingQuota: 5,
        isActive: true,
      })
      .returning();

    // 2. Setup 1 participant
    const [participant] = await db
      .insert(participants)
      .values({
        eventId: openEventId,
        name: 'Rollback Participant',
      })
      .returning();

    // 3. Execute a transaction that decrements quota then intentionally throws
    let errorCaught = false;
    try {
      await db.transaction(async (tx) => {
        // Decrement quota
        await tx
          .update(categories)
          .set({
            remainingQuota: sql`${categories.remainingQuota} - 1`,
            updatedAt: new Date(),
          })
          .where(eq(categories.id, category.id));

        // Intentionally simulate an abort/crash before commit
        throw new Error('Simulated crash midway through selection transaction');
      });
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toContain('Simulated crash midway');
    }

    expect(errorCaught).toBe(true);

    // 4. Verify quota was NOT decremented in committed state
    const [catAfterRollback] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, category.id));

    expect(catAfterRollback.remainingQuota).toBe(5);

    // 5. Verify no selection record exists for participant
    const selAfterRollback = await db
      .select()
      .from(selections)
      .where(eq(selections.participantId, participant.id));

    expect(selAfterRollback.length).toBe(0);

    // 6. Verify participant can still make a valid selection afterwards
    const validRes = await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/selections`)
      .send({
        participantId: participant.id,
        categoryId: category.id,
      });

    expect(validRes.status).toBe(201);

    const [catFinal] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, category.id));
    expect(catFinal.remainingQuota).toBe(4);

    const selFinal = await db
      .select()
      .from(selections)
      .where(eq(selections.participantId, participant.id));
    expect(selFinal.length).toBe(1);
  }, 30000);
});
