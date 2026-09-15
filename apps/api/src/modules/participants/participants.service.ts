import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_DB, type DrizzleDB } from '../../database/database.module.js';
import { participants } from '../../database/schema/index.js';
import { type ParticipantDto } from '@war-konsumsi/shared';
import { ParticipantNotFoundException } from '../../common/exceptions/business.exception.js';
import { EventsService } from '../events/events.service.js';

@Injectable()
export class ParticipantsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(EventsService) private readonly eventsService: EventsService,
  ) {}

  async joinEvent(eventId: string, name: string): Promise<ParticipantDto> {
    // Validate that event exists
    await this.eventsService.getEventById(eventId);

    const [row] = await this.db
      .insert(participants)
      .values({
        eventId,
        name: name.trim(),
      })
      .returning();

    return {
      id: row.id,
      eventId: row.eventId,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getParticipantById(participantId: string): Promise<ParticipantDto> {
    const [row] = await this.db
      .select()
      .from(participants)
      .where(eq(participants.id, participantId));

    if (!row) {
      throw new ParticipantNotFoundException();
    }

    return {
      id: row.id,
      eventId: row.eventId,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async validateParticipantInEvent(eventId: string, participantId: string): Promise<ParticipantDto> {
    const [row] = await this.db
      .select()
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.eventId, eventId)));

    if (!row) {
      throw new ParticipantNotFoundException();
    }

    return {
      id: row.id,
      eventId: row.eventId,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
