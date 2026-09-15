import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnvironmentConfig } from '../src/config/env.js';
import * as schema from '../src/database/schema/index.js';
import { events, categories, participants, selections } from '../src/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { EventStatus } from '@war-konsumsi/shared';

describe('PostgreSQL Database Constraints & Invariants', () => {
  let client: postgres.Sql;
  let db: PostgresJsDatabase<typeof schema>;
  let testEventId: string;
  let testCategoryId: string;
  let testParticipantId: string;

  beforeAll(async () => {
    const config = getEnvironmentConfig();
    client = postgres(config.databaseUrl, { max: 1 });
    db = drizzle(client, { schema });

    // Create a dedicated isolated test event
    const [event] = await db.insert(events).values({
      name: 'Constraint Test Event',
      status: EventStatus.OPEN,
      selectionStartsAt: new Date(),
    }).returning();
    testEventId = event.id;

    // Create a category
    const [cat] = await db.insert(categories).values({
      eventId: testEventId,
      name: 'Test Category',
      quota: 5,
      remainingQuota: 5,
    }).returning();
    testCategoryId = cat.id;

    // Create a participant
    const [p] = await db.insert(participants).values({
      eventId: testEventId,
      name: 'Constraint Test Participant',
    }).returning();
    testParticipantId = p.id;
  });

  afterAll(async () => {
    if (testEventId && db) {
      // Cascades will clean up categories, participants, and selections
      await db.delete(events).where(eq(events.id, testEventId));
    }
    if (client) {
      await client.end();
    }
  });

  it('Invariant 1: Rejects negative remaining_quota at database level', async () => {
    // Attempting to set remaining_quota < 0 must violate chk_categories_remaining_quota_positive
    await expect(
      db.insert(categories).values({
        eventId: testEventId,
        name: 'Negative Quota Category',
        quota: 10,
        remainingQuota: -1,
      })
    ).rejects.toThrow();
  });

  it('Invariant 2: Rejects remaining_quota > quota at database level', async () => {
    // Attempting to set remaining_quota > quota must violate chk_categories_remaining_quota_lte_quota
    await expect(
      db.insert(categories).values({
        eventId: testEventId,
        name: 'Overflow Category',
        quota: 5,
        remainingQuota: 6,
      })
    ).rejects.toThrow();
  });

  it('Invariant 3: Rejects invalid event status at database level', async () => {
    await expect(
      db.insert(events).values({
        name: 'Invalid Status Event',
        status: 'INVALID_STATUS' as any,
        selectionStartsAt: new Date(),
      })
    ).rejects.toThrow();
  });

  it('Invariant 4: Enforces UNIQUE(event_id, participant_id) for selections', async () => {
    // 1st selection for this participant in this event must succeed
    const [sel1] = await db.insert(selections).values({
      eventId: testEventId,
      participantId: testParticipantId,
      categoryId: testCategoryId,
    }).returning();
    expect(sel1.id).toBeDefined();

    // 2nd selection by the same participant in the same event MUST fail due to unique constraint
    await expect(
      db.insert(selections).values({
        eventId: testEventId,
        participantId: testParticipantId,
        categoryId: testCategoryId,
      })
    ).rejects.toThrow();
  });

  it('Invariant 5: Foreign key cascade deletes linked entities when event is removed', async () => {
    // Create a temporary event with linked participant and category
    const [tempEvent] = await db.insert(events).values({
      name: 'Temp Event For Cascade',
      status: EventStatus.OPEN,
      selectionStartsAt: new Date(),
    }).returning();

    const [tempCat] = await db.insert(categories).values({
      eventId: tempEvent.id,
      name: 'Temp Cat',
      quota: 1,
      remainingQuota: 1,
    }).returning();

    // Delete event
    await db.delete(events).where(eq(events.id, tempEvent.id));

    // Linked category must be deleted by cascade
    const found = await db.select().from(categories).where(eq(categories.id, tempCat.id));
    expect(found.length).toBe(0);
  });
});
