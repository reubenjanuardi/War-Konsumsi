import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq, and, sql, gt } from 'drizzle-orm';
import { DRIZZLE_DB, type DrizzleDB } from '../../database/database.module.js';
import { selections, categories, participants } from '../../database/schema/index.js';
import { EventStatus, type SelectionDto, type ParticipantSelectionResponseDto } from '@war-konsumsi/shared';
import {
  AlreadySelectedException,
  CategoryInactiveException,
  CategoryNotFoundException,
  EventNotOpenException,
  ParticipantNotFoundException,
  QuotaExhaustedException,
} from '../../common/exceptions/business.exception.js';
import { EventsService } from '../events/events.service.js';
import { ParticipantsService } from '../participants/participants.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

@Injectable()
export class SelectionsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Inject(ParticipantsService) private readonly participantsService: ParticipantsService,
    @Inject(RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async createSelection(
    eventId: string,
    participantId: string,
    categoryId: string,
  ): Promise<SelectionDto> {
    if (!eventId || !participantId || !categoryId) {
      throw new BadRequestException('ID event, peserta, dan kategori wajib diisi.');
    }

    // 1. Validate Event
    const event = await this.eventsService.getEventById(eventId);
    const now = new Date();

    const isStarted = now >= new Date(event.selectionStartsAt);
    const isEnded = event.selectionEndsAt ? now > new Date(event.selectionEndsAt) : false;
    const isOpen = event.status === EventStatus.OPEN && isStarted && !isEnded;

    if (!isOpen) {
      throw new EventNotOpenException();
    }

    // 2. Validate Participant belongs to event
    await this.participantsService.validateParticipantInEvent(eventId, participantId);

    // 3. Pre-validate participant selection status
    const [existingSelection] = await this.db
      .select({ id: selections.id })
      .from(selections)
      .where(and(eq(selections.eventId, eventId), eq(selections.participantId, participantId)));

    if (existingSelection) {
      throw new AlreadySelectedException();
    }

    // 4. Pre-validate Category
    const [category] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.eventId, eventId)));

    if (!category) {
      throw new CategoryNotFoundException();
    }

    if (!category.isActive) {
      throw new CategoryInactiveException();
    }

    if (category.remainingQuota <= 0) {
      throw new QuotaExhaustedException();
    }

    // 5. Execute within a transactional boundary
    let committedResult: {
      selection: SelectionDto;
      remainingQuota: number;
    } | null = null;

    try {
      committedResult = await this.db.transaction(async (tx) => {
        // 5a. Lock participant row to cleanly serialize concurrent duplicate requests from the same participant
        const [lockedParticipant] = await tx
          .select({ id: participants.id })
          .from(participants)
          .where(and(eq(participants.id, participantId), eq(participants.eventId, eventId)))
          .for('update');

        if (!lockedParticipant) {
          throw new ParticipantNotFoundException();
        }

        // 5b. Re-check participant selection in transaction under participant lock
        const [duplicate] = await tx
          .select({ id: selections.id })
          .from(selections)
          .where(and(eq(selections.eventId, eventId), eq(selections.participantId, participantId)));

        if (duplicate) {
          throw new AlreadySelectedException();
        }

        // 5c. Atomic quota decrement with condition remaining_quota > 0
        const updated = await tx
          .update(categories)
          .set({
            remainingQuota: sql`${categories.remainingQuota} - 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(categories.id, categoryId),
              eq(categories.eventId, eventId),
              eq(categories.isActive, true),
              gt(categories.remainingQuota, 0),
            ),
          )
          .returning();

        if (updated.length === 0) {
          throw new QuotaExhaustedException();
        }

        // 5d. Insert selection record
        const [newSelection] = await tx
          .insert(selections)
          .values({
            eventId,
            participantId,
            categoryId,
            selectedAt: new Date(),
          })
          .returning();

        return {
          selection: {
            id: newSelection.id,
            eventId: newSelection.eventId,
            participantId: newSelection.participantId,
            categoryId: newSelection.categoryId,
            categoryName: category.name,
            selectedAt: newSelection.selectedAt.toISOString(),
          },
          remainingQuota: updated[0].remainingQuota,
        };
      });
    } catch (error: any) {
      // Catch PostgreSQL unique violation 23505 on uq_selections_event_participant
      if (
        error?.code === '23505' &&
        (error?.constraint_name?.includes('selections') || error?.message?.includes('uq_selections_event_participant'))
      ) {
        throw new AlreadySelectedException();
      }
      throw error;
    }

    // STRICT POST-COMMIT: Broadcast ONLY after the transaction has successfully committed
    if (committedResult) {
      const status = CategoriesService.computeStatus(committedResult.remainingQuota);
      this.realtimeGateway.broadcastQuotaUpdate(eventId, {
        categoryId,
        remainingQuota: committedResult.remainingQuota,
        status,
      });

      return committedResult.selection;
    }

    throw new Error('Unexpected selection transaction state');
  }

  async getParticipantSelection(
    eventId: string,
    participantId: string,
  ): Promise<ParticipantSelectionResponseDto> {
    // Validate that participant belongs to event
    await this.participantsService.validateParticipantInEvent(eventId, participantId);

    const [row] = await this.db
      .select({
        id: selections.id,
        eventId: selections.eventId,
        participantId: selections.participantId,
        categoryId: selections.categoryId,
        categoryName: categories.name,
        selectedAt: selections.selectedAt,
      })
      .from(selections)
      .innerJoin(categories, eq(selections.categoryId, categories.id))
      .where(and(eq(selections.eventId, eventId), eq(selections.participantId, participantId)));

    if (!row) {
      return {
        hasSelected: false,
        selection: null,
      };
    }

    return {
      hasSelected: true,
      selection: {
        id: row.id,
        eventId: row.eventId,
        participantId: row.participantId,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        selectedAt: row.selectedAt.toISOString(),
      },
    };
  }
}
