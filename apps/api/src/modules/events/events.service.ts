import { Injectable, Inject } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE_DB, type DrizzleDB } from '../../database/database.module.js';
import { events } from '../../database/schema/index.js';
import { EventStatus, type EventDetailDto } from '@war-konsumsi/shared';
import { EventNotFoundException } from '../../common/exceptions/business.exception.js';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

@Injectable()
export class EventsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async getCurrentEvent(): Promise<EventDetailDto> {
    const [event] = await this.db
      .select()
      .from(events)
      .orderBy(desc(events.createdAt))
      .limit(1);

    if (!event) {
      throw new EventNotFoundException('Belum ada event yang aktif.');
    }

    return {
      id: event.id,
      name: event.name,
      status: event.status as EventStatus,
      selectionStartsAt: event.selectionStartsAt.toISOString(),
      selectionEndsAt: event.selectionEndsAt ? event.selectionEndsAt.toISOString() : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      serverTime: new Date().toISOString(),
    };
  }

  async getAllEvents(): Promise<EventDetailDto[]> {
    const rows = await this.db
      .select()
      .from(events)
      .orderBy(desc(events.createdAt));

    const now = new Date().toISOString();
    return rows.map((event) => ({
      id: event.id,
      name: event.name,
      status: event.status as EventStatus,
      selectionStartsAt: event.selectionStartsAt.toISOString(),
      selectionEndsAt: event.selectionEndsAt ? event.selectionEndsAt.toISOString() : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      serverTime: now,
    }));
  }

  async getEventById(eventId: string): Promise<EventDetailDto> {
    const [event] = await this.db
      .select()
      .from(events)
      .where(eq(events.id, eventId));

    if (!event) {
      throw new EventNotFoundException();
    }

    return {
      id: event.id,
      name: event.name,
      status: event.status as EventStatus,
      selectionStartsAt: event.selectionStartsAt.toISOString(),
      selectionEndsAt: event.selectionEndsAt ? event.selectionEndsAt.toISOString() : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      serverTime: new Date().toISOString(),
    };
  }

  async createEvent(dto: CreateEventDto) {
    const [created] = await this.db
      .insert(events)
      .values({
        name: dto.name,
        status: dto.status || EventStatus.DRAFT,
        selectionStartsAt: new Date(dto.selectionStartsAt),
        selectionEndsAt: dto.selectionEndsAt ? new Date(dto.selectionEndsAt) : null,
      })
      .returning();

    return this.getEventById(created.id);
  }

  async updateEvent(eventId: string, dto: UpdateEventDto) {
    await this.getEventById(eventId); // Throws if not found

    const updateData: Partial<typeof events.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.selectionStartsAt !== undefined) updateData.selectionStartsAt = new Date(dto.selectionStartsAt);
    if (dto.selectionEndsAt !== undefined) {
      updateData.selectionEndsAt = dto.selectionEndsAt ? new Date(dto.selectionEndsAt) : null;
    }

    await this.db
      .update(events)
      .set(updateData)
      .where(eq(events.id, eventId));

    const updatedEvent = await this.getEventById(eventId);

    if (dto.status !== undefined) {
      this.realtimeGateway.broadcastEventStatus(eventId, {
        eventId: updatedEvent.id,
        status: updatedEvent.status,
      });
    }

    return updatedEvent;
  }

  async openEvent(eventId: string) {
    return this.updateEvent(eventId, {
      status: EventStatus.OPEN,
      selectionStartsAt: new Date().toISOString(),
    });
  }

  async closeEvent(eventId: string) {
    return this.updateEvent(eventId, {
      status: EventStatus.CLOSED,
      selectionEndsAt: new Date().toISOString(),
    });
  }
}
