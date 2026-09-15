import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { GlobalHttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DRIZZLE_DB, type DrizzleDB } from '../src/database/database.module.js';
import { events, categories, participants, selections } from '../src/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { EventStatus, CategoryStatus } from '@war-konsumsi/shared';
import { getEnvironmentConfig } from '../src/config/env.js';

describe('Core Backend API Integration Tests', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  const config = getEnvironmentConfig();

  // Test state
  let testEventId: string;
  let openEventId: string;
  let categoryAvailableId: string;
  let categorySoldOutId: string;
  let categoryInactiveId: string;
  let participant1Id: string;
  let participant2Id: string;

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

    // 1. Setup a WAITING event
    const [waitingEvent] = await db
      .insert(events)
      .values({
        name: 'Waiting Test Event',
        status: EventStatus.WAITING,
        selectionStartsAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour in future
      })
      .returning();
    testEventId = waitingEvent.id;

    // 2. Setup an OPEN event
    const [openEv] = await db
      .insert(events)
      .values({
        name: 'Open Test Event',
        status: EventStatus.OPEN,
        selectionStartsAt: new Date(Date.now() - 1000), // 1s in past
      })
      .returning();
    openEventId = openEv.id;

    // 3. Setup categories for the OPEN event
    const [catAvailable] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Ayam Goreng',
        quota: 10,
        remainingQuota: 5,
        isActive: true,
      })
      .returning();
    categoryAvailableId = catAvailable.id;

    const [catSoldOut] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Daging Rendang',
        quota: 10,
        remainingQuota: 0,
        isActive: true,
      })
      .returning();
    categorySoldOutId = catSoldOut.id;

    const [catInactive] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Ikan Bakar Inaktif',
        quota: 5,
        remainingQuota: 5,
        isActive: false,
      })
      .returning();
    categoryInactiveId = catInactive.id;

    // 4. Setup participants
    const [p1] = await db
      .insert(participants)
      .values({
        eventId: openEventId,
        name: 'Peserta Satu',
      })
      .returning();
    participant1Id = p1.id;

    const [p2] = await db
      .insert(participants)
      .values({
        eventId: openEventId,
        name: 'Peserta Dua',
      })
      .returning();
    participant2Id = p2.id;
  });

  afterAll(async () => {
    // Clean up test events (cascades all participants, categories, selections)
    if (testEventId) await db.delete(events).where(eq(events.id, testEventId));
    if (openEventId) await db.delete(events).where(eq(events.id, openEventId));
    await app.close();
  });

  describe('GET /api/events/:eventId', () => {
    it('should return event details with authoritative serverTime for a valid event', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/events/${testEventId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.event.id).toBe(testEventId);
      expect(res.body.event.name).toBe('Waiting Test Event');
      expect(res.body.event.status).toBe(EventStatus.WAITING);
      expect(res.body.event.serverTime).toBeDefined();
    });

    it('should return 404 when event is not found', async () => {
      const nonExistentId = '00000000-0000-4000-8000-000000000000';
      const res = await request(app.getHttpServer())
        .get(`/api/events/${nonExistentId}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EVENT_NOT_FOUND');
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/events/invalid-uuid')
        .expect(400);
    });
  });

  describe('POST /api/events/:eventId/join', () => {
    it('should allow a participant to join with valid name', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/${testEventId}/join`)
        .send({ name: '  Andi Pratama  ' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.participant.id).toBeDefined();
      expect(res.body.participant.name).toBe('Andi Pratama'); // Trimmed
      expect(res.body.participant.eventId).toBe(testEventId);
    });

    it('should reject joining with a name that is too short', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/${testEventId}/join`)
        .send({ name: 'A' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('minimal 2 karakter');
    });

    it('should reject joining a non-existent event', async () => {
      const nonExistentId = '00000000-0000-4000-8000-000000000000';
      const res = await request(app.getHttpServer())
        .post(`/api/events/${nonExistentId}/join`)
        .send({ name: 'Valid Name' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EVENT_NOT_FOUND');
    });
  });

  describe('GET /api/events/:eventId/categories', () => {
    it('should return only active categories and compute status accurately', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/events/${openEventId}/categories`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.categories)).toBe(true);

      const available = res.body.categories.find((c: any) => c.id === categoryAvailableId);
      expect(available).toBeDefined();
      expect(available.remainingQuota).toBe(5);
      expect(available.status).toBe(CategoryStatus.AVAILABLE);

      const soldOut = res.body.categories.find((c: any) => c.id === categorySoldOutId);
      expect(soldOut).toBeDefined();
      expect(soldOut.remainingQuota).toBe(0);
      expect(soldOut.status).toBe(CategoryStatus.SOLD_OUT);

      // Inactive category should NOT be in the participant category list
      const inactive = res.body.categories.find((c: any) => c.id === categoryInactiveId);
      expect(inactive).toBeUndefined();
    });
  });

  describe('POST /api/events/:eventId/selections', () => {
    it('should reject selection when event status is not OPEN', async () => {
      // testEventId is WAITING
      const res = await request(app.getHttpServer())
        .post(`/api/events/${testEventId}/selections`)
        .send({
          participantId: participant1Id,
          categoryId: categoryAvailableId,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EVENT_NOT_OPEN');
    });

    it('should reject selection when participant does not belong to event', async () => {
      const nonExistentParticipant = '00000000-0000-4000-8000-000000000001';
      const res = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId: nonExistentParticipant,
          categoryId: categoryAvailableId,
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('PARTICIPANT_NOT_FOUND');
    });

    it('should reject selection for non-existent category', async () => {
      const nonExistentCategory = '00000000-0000-4000-8000-000000000002';
      const res = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId: participant1Id,
          categoryId: nonExistentCategory,
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('CATEGORY_NOT_FOUND');
    });

    it('should reject selection for inactive category', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId: participant1Id,
          categoryId: categoryInactiveId,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('CATEGORY_INACTIVE');
    });

    it('should reject selection when category quota is exhausted', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId: participant1Id,
          categoryId: categorySoldOutId,
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('QUOTA_EXHAUSTED');
    });

    it('should successfully allocate quota and create selection for valid request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId: participant1Id,
          categoryId: categoryAvailableId,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.selection.id).toBeDefined();
      expect(res.body.selection.participantId).toBe(participant1Id);
      expect(res.body.selection.categoryId).toBe(categoryAvailableId);
      expect(res.body.selection.categoryName).toBe('Ayam Goreng');

      // Verify category remaining quota was decremented in database
      const [cat] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, categoryAvailableId));
      expect(cat.remainingQuota).toBe(4); // was 5
    });

    it('should reject second selection attempt by the same participant (ALREADY_SELECTED)', async () => {
      // participant1Id already selected
      const res = await request(app.getHttpServer())
        .post(`/api/events/${openEventId}/selections`)
        .send({
          participantId: participant1Id,
          categoryId: categoryAvailableId,
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('ALREADY_SELECTED');
    });
  });

  describe('GET /api/events/:eventId/participants/:participantId/selection', () => {
    it('should return selection details for a participant who has selected', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/events/${openEventId}/participants/${participant1Id}/selection`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.hasSelected).toBe(true);
      expect(res.body.selection).toBeDefined();
      expect(res.body.selection.categoryId).toBe(categoryAvailableId);
      expect(res.body.selection.categoryName).toBe('Ayam Goreng');
    });

    it('should return hasSelected: false for a participant who has not selected', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/events/${openEventId}/participants/${participant2Id}/selection`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.hasSelected).toBe(false);
      expect(res.body.selection).toBeNull();
    });
  });

  describe('Admin Foundation Endpoints', () => {
    it('should reject unauthorized admin request without secret', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/events')
        .send({
          name: 'Unauthorized Event',
          selectionStartsAt: new Date().toISOString(),
        })
        .expect(401);
    });

    it('should allow authorized admin to create event and categories', async () => {
      // Create Event
      const eventRes = await request(app.getHttpServer())
        .post('/api/admin/events')
        .set('x-admin-secret', config.adminSecret)
        .send({
          name: 'Admin Created Event',
          selectionStartsAt: new Date(Date.now() + 10000).toISOString(),
          status: EventStatus.WAITING,
        })
        .expect(201);

      expect(eventRes.body.success).toBe(true);
      const createdEventId = eventRes.body.event.id;

      // Create Category
      const catRes = await request(app.getHttpServer())
        .post(`/api/admin/events/${createdEventId}/categories`)
        .set('x-admin-secret', config.adminSecret)
        .send({
          name: 'Admin Food',
          quota: 20,
        })
        .expect(201);

      expect(catRes.body.success).toBe(true);
      expect(catRes.body.category.name).toBe('Admin Food');

      // Open Event
      const openRes = await request(app.getHttpServer())
        .post(`/api/admin/events/${createdEventId}/open`)
        .set('x-admin-secret', config.adminSecret)
        .expect(201);

      expect(openRes.body.event.status).toBe(EventStatus.OPEN);

      // Clean up
      await db.delete(events).where(eq(events.id, createdEventId));
    });
  });
});
