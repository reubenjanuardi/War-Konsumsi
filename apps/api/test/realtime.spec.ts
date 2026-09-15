import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { GlobalHttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { DRIZZLE_DB, type DrizzleDB } from '../src/database/database.module.js';
import { events, categories, participants, selections } from '../src/database/schema/index.js';
import { eq } from 'drizzle-orm';
import {
  EventStatus,
  CategoryStatus,
  SOCKET_EVENTS,
  type CategoryQuotaUpdatedPayload,
  type EventStatusUpdatedPayload,
} from '@war-konsumsi/shared';

describe('Realtime Socket.IO Integration Tests', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  let serverPort: number;
  let openEventId: string;
  let clientSocket: Socket;

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
    await app.listen(0);

    const address = app.getHttpServer().address();
    serverPort = typeof address === 'string' ? parseInt(address, 10) : address.port;

    db = moduleFixture.get<DrizzleDB>(DRIZZLE_DB);

    // Create OPEN event for realtime testing
    const [openEv] = await db
      .insert(events)
      .values({
        name: 'Realtime War Event',
        status: EventStatus.OPEN,
        selectionStartsAt: new Date(Date.now() - 5000),
      })
      .returning();
    openEventId = openEv.id;
  });

  afterAll(async () => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
    if (openEventId && db) {
      await db.delete(events).where(eq(events.id, openEventId));
    }
    await app.close();
  });

  beforeEach(async () => {
    clientSocket = io(`http://localhost:${serverPort}`, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: true,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
      if (clientSocket.connected) {
        clearTimeout(timer);
        resolve();
      } else {
        clientSocket.once('connect', () => {
          clearTimeout(timer);
          resolve();
        });
      }
    });

    // Join the event room
    clientSocket.emit(SOCKET_EVENTS.JOIN_EVENT, { eventId: openEventId });
    await new Promise((r) => setTimeout(r, 60));
  });

  afterEach(() => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
  });

  // =========================================================================
  // 1. Quota update event test
  // =========================================================================
  it('should broadcast category.quota.updated with categoryId, remainingQuota, and status upon successful selection', async () => {
    // Setup category with quota = 5
    const [category] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Realtime Sate Ayam',
        quota: 5,
        remainingQuota: 5,
        isActive: true,
      })
      .returning();

    // Setup participant
    const [participant] = await db
      .insert(participants)
      .values({
        eventId: openEventId,
        name: 'Realtime Participant 1',
      })
      .returning();

    // Setup listener promise
    const eventPromise = new Promise<CategoryQuotaUpdatedPayload>((resolve) => {
      clientSocket.once(SOCKET_EVENTS.CATEGORY_QUOTA_UPDATED, (payload: CategoryQuotaUpdatedPayload) => {
        resolve(payload);
      });
    });

    // Send selection request
    const res = await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/selections`)
      .send({
        participantId: participant.id,
        categoryId: category.id,
      });

    expect(res.status).toBe(201);

    // Await broadcast
    const receivedPayload = await eventPromise;

    expect(receivedPayload).toEqual({
      categoryId: category.id,
      remainingQuota: 4,
      status: CategoryStatus.AVAILABLE,
    });
  });

  // =========================================================================
  // 2. Sold out event test
  // =========================================================================
  it('should broadcast status SOLD_OUT and remainingQuota 0 when last quota is taken', async () => {
    // Setup category with quota = 1
    const [category] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Realtime Last Bakso',
        quota: 1,
        remainingQuota: 1,
        isActive: true,
      })
      .returning();

    const [participant] = await db
      .insert(participants)
      .values({
        eventId: openEventId,
        name: 'Last Quota Winner',
      })
      .returning();

    const eventPromise = new Promise<CategoryQuotaUpdatedPayload>((resolve) => {
      clientSocket.once(SOCKET_EVENTS.CATEGORY_QUOTA_UPDATED, (payload: CategoryQuotaUpdatedPayload) => {
        resolve(payload);
      });
    });

    const res = await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/selections`)
      .send({
        participantId: participant.id,
        categoryId: category.id,
      });

    expect(res.status).toBe(201);

    const receivedPayload = await eventPromise;

    expect(receivedPayload).toEqual({
      categoryId: category.id,
      remainingQuota: 0,
      status: CategoryStatus.SOLD_OUT,
    });
  });

  // =========================================================================
  // 3. Reconnect behavior test
  // =========================================================================
  it('should resume receiving realtime broadcasts after socket disconnection and reconnection', async () => {
    const [category] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Reconnect Category',
        quota: 10,
        remainingQuota: 10,
        isActive: true,
      })
      .returning();

    const [p1] = await db
      .insert(participants)
      .values({ eventId: openEventId, name: 'Before Disconnect User' })
      .returning();

    const [p2] = await db
      .insert(participants)
      .values({ eventId: openEventId, name: 'After Reconnect User' })
      .returning();

    // 1. First selection before disconnect
    await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/selections`)
      .send({ participantId: p1.id, categoryId: category.id });

    // 2. Disconnect socket
    clientSocket.disconnect();
    expect(clientSocket.connected).toBe(false);

    // 3. Reconnect socket
    clientSocket.connect();
    await new Promise<void>((resolve) => {
      clientSocket.once('connect', () => resolve());
    });
    expect(clientSocket.connected).toBe(true);

    // Rejoin event room
    clientSocket.emit(SOCKET_EVENTS.JOIN_EVENT, { eventId: openEventId });
    await new Promise((r) => setTimeout(r, 60));

    // 4. Setup listener on reconnected socket
    const reconnectedEventPromise = new Promise<CategoryQuotaUpdatedPayload>((resolve) => {
      clientSocket.once(SOCKET_EVENTS.CATEGORY_QUOTA_UPDATED, (payload: CategoryQuotaUpdatedPayload) => {
        resolve(payload);
      });
    });

    // 5. Fire second selection
    await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/selections`)
      .send({ participantId: p2.id, categoryId: category.id });

    const received = await reconnectedEventPromise;
    expect(received.categoryId).toBe(category.id);
    expect(received.remainingQuota).toBe(8);
  });

  // =========================================================================
  // 4. Stale state recovery test
  // =========================================================================
  it('should allow disconnected client to recover stale state from authoritative PostgreSQL endpoints and resume realtime', async () => {
    const [category] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Stale State Category',
        quota: 10,
        remainingQuota: 10,
        isActive: true,
      })
      .returning();

    const [offlineParticipant] = await db
      .insert(participants)
      .values({ eventId: openEventId, name: 'Offline Participant' })
      .returning();

    const [otherParticipant] = await db
      .insert(participants)
      .values({ eventId: openEventId, name: 'Active Online User' })
      .returning();

    // Client connects and initially sees quota = 10
    let localClientQuotaState = 10;

    // Client drops connection (offline)
    clientSocket.disconnect();

    // While client is disconnected, server processes selections in PostgreSQL
    // otherParticipant selects category (10 -> 9)
    await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/selections`)
      .send({ participantId: otherParticipant.id, categoryId: category.id });

    // offlineParticipant also had a selection submitted (e.g. from background or retry) (9 -> 8)
    await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/selections`)
      .send({ participantId: offlineParticipant.id, categoryId: category.id });

    // Client is still offline and has stale quota state: 10
    expect(localClientQuotaState).toBe(10);

    // Client reconnects
    clientSocket.connect();
    await new Promise<void>((resolve) => {
      clientSocket.once('connect', () => resolve());
    });

    // Mandatory Resynchronization Protocol:
    // 1. Fetch current categories state from authoritative PostgreSQL API
    const categoriesRes = await request(app.getHttpServer()).get(`/api/events/${openEventId}/categories`);
    expect(categoriesRes.status).toBe(200);

    const fetchedCategory = categoriesRes.body.categories.find((c: any) => c.id === category.id);
    expect(fetchedCategory).toBeDefined();

    // Replace stale client state with authoritative server state
    localClientQuotaState = fetchedCategory.remainingQuota;
    expect(localClientQuotaState).toBe(8); // Synchronized!

    // 2. Fetch participant selection state
    const selectionRes = await request(app.getHttpServer()).get(
      `/api/events/${openEventId}/participants/${offlineParticipant.id}/selection`,
    );
    expect(selectionRes.status).toBe(200);
    expect(selectionRes.body.hasSelected).toBe(true);
    expect(selectionRes.body.selection.categoryId).toBe(category.id);

    // 3. Re-join room and resume realtime subscription
    clientSocket.emit(SOCKET_EVENTS.JOIN_EVENT, { eventId: openEventId });
    await new Promise((r) => setTimeout(r, 60));

    // Next live event
    const [futureParticipant] = await db
      .insert(participants)
      .values({ eventId: openEventId, name: 'Future Participant' })
      .returning();

    const nextEventPromise = new Promise<CategoryQuotaUpdatedPayload>((resolve) => {
      clientSocket.once(SOCKET_EVENTS.CATEGORY_QUOTA_UPDATED, (payload) => resolve(payload));
    });

    await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/selections`)
      .send({ participantId: futureParticipant.id, categoryId: category.id });

    const livePayload = await nextEventPromise;
    expect(livePayload.remainingQuota).toBe(7);
  });

  // =========================================================================
  // 5. Rollback does not broadcast test
  // =========================================================================
  it('should NEVER broadcast quota updates when a transaction rolls back or fails', async () => {
    // Setup category with quota = 1
    const [category] = await db
      .insert(categories)
      .values({
        eventId: openEventId,
        name: 'Zero Broadcast On Rollback',
        quota: 1,
        remainingQuota: 1,
        isActive: true,
      })
      .returning();

    const [participantWinner] = await db
      .insert(participants)
      .values({ eventId: openEventId, name: 'Winner User' })
      .returning();

    const [participantLoser] = await db
      .insert(participants)
      .values({ eventId: openEventId, name: 'Loser User' })
      .returning();

    // 1. First request takes the quota (1 -> 0)
    const initialEventPromise = new Promise<CategoryQuotaUpdatedPayload>((resolve) => {
      clientSocket.once(SOCKET_EVENTS.CATEGORY_QUOTA_UPDATED, (payload) => resolve(payload));
    });

    await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/selections`)
      .send({ participantId: participantWinner.id, categoryId: category.id });

    const initialPayload = await initialEventPromise;
    expect(initialPayload.remainingQuota).toBe(0);

    // 2. Attach a spy listener to check for any unexpected broadcasts
    let unexpectedBroadcastCount = 0;
    const spyListener = () => {
      unexpectedBroadcastCount++;
    };
    clientSocket.on(SOCKET_EVENTS.CATEGORY_QUOTA_UPDATED, spyListener);

    // 3. Failed attempt 1: Quota exhausted (409 QUOTA_EXHAUSTED) -> rollback
    const failedQuotaRes = await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/selections`)
      .send({ participantId: participantLoser.id, categoryId: category.id });
    expect(failedQuotaRes.status).toBe(409);
    expect(failedQuotaRes.body.code).toBe('QUOTA_EXHAUSTED');

    // 4. Failed attempt 2: Already selected (409 ALREADY_SELECTED) -> rollback
    const failedDuplicateRes = await request(app.getHttpServer())
      .post(`/api/events/${openEventId}/selections`)
      .send({ participantId: participantWinner.id, categoryId: category.id });
    expect(failedDuplicateRes.status).toBe(409);
    expect(failedDuplicateRes.body.code).toBe('ALREADY_SELECTED');

    // 5. Wait to ensure nothing was emitted
    await new Promise((r) => setTimeout(r, 350));
    clientSocket.off(SOCKET_EVENTS.CATEGORY_QUOTA_UPDATED, spyListener);

    // Assert that ZERO broadcasts occurred during the rolled-back requests
    expect(unexpectedBroadcastCount).toBe(0);
  });
});
