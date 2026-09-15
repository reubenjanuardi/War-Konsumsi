import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { GlobalHttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DRIZZLE_DB, type DrizzleDB } from '../src/database/database.module.js';
import { events, categories, participants, selections } from '../src/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { EventStatus } from '@war-konsumsi/shared';
import { getEnvironmentConfig } from '../src/config/env.js';

describe('Admin Backend API & Security Tests', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  const config = getEnvironmentConfig();
  const validSecret = config.adminSecret || 'dev-admin-secret';

  let testEventId: string;
  let testCategoryId: string;
  let testParticipantId: string;
  let testSelectionId: string;

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

    // Setup a test event
    const [ev] = await db
      .insert(events)
      .values({
        name: 'Admin Test Gathering 2026',
        status: EventStatus.OPEN,
        selectionStartsAt: new Date(Date.now() - 1000),
      })
      .returning();
    testEventId = ev.id;

    // Setup category with quota 5, remaining 4
    const [cat] = await db
      .insert(categories)
      .values({
        eventId: testEventId,
        name: 'Paket Nasi Padang',
        quota: 5,
        remainingQuota: 4,
        isActive: true,
      })
      .returning();
    testCategoryId = cat.id;

    // Setup participant
    const [part] = await db
      .insert(participants)
      .values({
        eventId: testEventId,
        name: 'Admin Test Participant',
      })
      .returning();
    testParticipantId = part.id;

    // Setup selection
    const [sel] = await db
      .insert(selections)
      .values({
        eventId: testEventId,
        participantId: testParticipantId,
        categoryId: testCategoryId,
      })
      .returning();
    testSelectionId = sel.id;
  });

  afterAll(async () => {
    if (testEventId) {
      await db.delete(events).where(eq(events.id, testEventId));
    }
    await app.close();
  });

  describe('1. Security & Server-Side Authorization', () => {
    it('rejects access when no secret header is provided (401)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/events/${testEventId}/dashboard`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Akses admin tidak sah');
    });

    it('rejects access when invalid secret is provided (401)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/events/${testEventId}/dashboard`)
        .set('x-admin-secret', 'wrong-secret-12345');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Akses admin tidak sah');
    });

    it('allows access when valid x-admin-secret is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/auth/verify')
        .set('x-admin-secret', validSecret);

      expect(res.status).toBe(201); // Default POST status
      expect(res.body.success).toBe(true);
    });

    it('allows access when valid Authorization: Bearer header is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/auth/verify')
        .set('Authorization', `Bearer ${validSecret}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('allows login via POST /api/admin/auth/login and authenticates with HttpOnly cookie', async () => {
      // 1. Successful login
      const loginRes = await request(app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({ secret: validSecret });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      const cookies = loginRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
      expect(cookieStr).toContain('war_admin_token=');
      expect(cookieStr.toLowerCase()).toContain('httponly');

      // 2. Use cookie to access protected endpoint
      const verifyRes = await request(app.getHttpServer())
        .get('/api/admin/auth/verify')
        .set('Cookie', `war_admin_token=${validSecret}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.authenticated).toBe(true);

      // 3. Logout clears cookie
      const logoutRes = await request(app.getHttpServer())
        .post('/api/admin/auth/logout');

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
    });
  });

  describe('2. Admin Dashboard & Telemetry', () => {
    it('returns aggregated metrics for the event', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/events/${testEventId}/dashboard`)
        .set('x-admin-secret', validSecret);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalParticipants).toBe(1);
      expect(res.body.data.selectedParticipants).toBe(1);
      expect(res.body.data.unselectedParticipants).toBe(0);
      expect(res.body.data.totalQuota).toBe(5);
      expect(res.body.data.totalRemainingQuota).toBe(4);
      expect(res.body.data.categories).toHaveLength(1);
      expect(res.body.data.categories[0].name).toBe('Paket Nasi Padang');
    });

    it('lists all events for management', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/events')
        .set('x-admin-secret', validSecret);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.events)).toBe(true);
      const found = res.body.events.find((e: any) => e.id === testEventId);
      expect(found).toBeDefined();
    });

    it('returns database consistency diagnostic check proving invariant initial_quota - selections = remaining_quota', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/events/${testEventId}/consistency`)
        .set('x-admin-secret', validSecret);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isConsistent).toBe(true);
      expect(res.body.issues).toHaveLength(0);
      expect(res.body.summary.totalInitialQuota).toBe(5);
      expect(res.body.summary.totalRemainingQuota).toBe(4);
      expect(res.body.summary.totalSelections).toBe(1);
      expect(res.body.categories).toHaveLength(1);
      expect(res.body.categories[0].isConsistent).toBe(true);
      expect(res.body.categories[0].expectedRemainingQuota).toBe(4);
      expect(res.body.categories[0].remainingQuota).toBe(4);
    });
  });

  describe('3. Participant & Selection Monitoring', () => {
    it('lists participants with their current selection information', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/events/${testEventId}/participants`)
        .set('x-admin-secret', validSecret);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.participants).toHaveLength(1);
      expect(res.body.participants[0].name).toBe('Admin Test Participant');
      expect(res.body.participants[0].selection).toBeDefined();
      expect(res.body.participants[0].selection.categoryName).toBe('Paket Nasi Padang');
    });

    it('filters participants by search query', async () => {
      const resMatch = await request(app.getHttpServer())
        .get(`/api/admin/events/${testEventId}/participants?search=Test`)
        .set('x-admin-secret', validSecret);
      expect(resMatch.body.participants).toHaveLength(1);

      const resNone = await request(app.getHttpServer())
        .get(`/api/admin/events/${testEventId}/participants?search=NonExistent`)
        .set('x-admin-secret', validSecret);
      expect(resNone.body.participants).toHaveLength(0);
    });

    it('lists selection audit records with timestamps', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/events/${testEventId}/selections`)
        .set('x-admin-secret', validSecret);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.selections).toHaveLength(1);
      expect(res.body.selections[0].participantName).toBe('Admin Test Participant');
      expect(res.body.selections[0].categoryName).toBe('Paket Nasi Padang');
      expect(res.body.selections[0].selectedAt).toBeDefined();
    });
  });

  describe('4. Quota Reset & Emergency Controls', () => {
    it('resets category quota safely', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/admin/events/${testEventId}/categories/${testCategoryId}/reset-quota`)
        .set('x-admin-secret', validSecret)
        .send({ remainingQuota: 5 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.category.remainingQuota).toBe(5);

      // Verify in DB
      const [cat] = await db.select().from(categories).where(eq(categories.id, testCategoryId));
      expect(cat.remainingQuota).toBe(5);
    });

    it('cancels participant selection and atomically restores remaining quota', async () => {
      // First decrement quota to 4 to reflect selection
      await db.update(categories).set({ remainingQuota: 4 }).where(eq(categories.id, testCategoryId));

      const res = await request(app.getHttpServer())
        .delete(`/api/admin/events/${testEventId}/selections/${testSelectionId}`)
        .set('x-admin-secret', validSecret);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify selection is deleted from DB
      const [sel] = await db.select().from(selections).where(eq(selections.id, testSelectionId));
      expect(sel).toBeUndefined();

      // Verify category quota incremented back to 5
      const [cat] = await db.select().from(categories).where(eq(categories.id, testCategoryId));
      expect(cat.remainingQuota).toBe(5);
    });

    it('performs emergency force-close on the event', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/admin/events/${testEventId}/force-close`)
        .set('x-admin-secret', validSecret);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.event.status).toBe(EventStatus.CLOSED);

      // Verify in DB
      const [ev] = await db.select().from(events).where(eq(events.id, testEventId));
      expect(ev.status).toBe(EventStatus.CLOSED);
    });

    it('deletes category and broadcasts sold out state', async () => {
      const [cat] = await db
        .insert(categories)
        .values({
          eventId: testEventId,
          name: 'Category To Delete',
          quota: 10,
          remainingQuota: 10,
        })
        .returning();

      const res = await request(app.getHttpServer())
        .delete(`/api/admin/events/${testEventId}/categories/${cat.id}`)
        .set('x-admin-secret', validSecret);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const [deleted] = await db.select().from(categories).where(eq(categories.id, cat.id));
      expect(deleted).toBeUndefined();
    });
  });

  describe('5. Data Export (CSV)', () => {
    it('exports participants and selections as CSV with UTF-8 BOM', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/events/${testEventId}/export`)
        .set('x-admin-secret', validSecret);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename=');
      expect(res.text.startsWith('\uFEFF')).toBe(true);
      expect(res.text).toContain('ID Peserta,Nama Peserta,Waktu Daftar,Kategori Terpilih');
      expect(res.text).toContain('Admin Test Participant');
    });
  });
});
