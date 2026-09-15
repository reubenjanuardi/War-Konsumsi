import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, sql, desc, ilike } from 'drizzle-orm';
import { DRIZZLE_DB, type DrizzleDB } from '../../database/database.module.js';
import { events, participants, categories, selections } from '../../database/schema/index.js';
import {
  type AdminDashboardDto,
  type AdminParticipantItemDto,
  type AdminSelectionItemDto,
  EventStatus,
} from '@war-konsumsi/shared';
import { EventsService } from '../events/events.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Inject(CategoriesService) private readonly categoriesService: CategoriesService,
    @Inject(RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async getDashboardStats(eventId: string): Promise<AdminDashboardDto> {
    const event = await this.eventsService.getEventById(eventId);
    const categoryList = await this.categoriesService.getCategoriesByEvent(eventId, false);

    const [pCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(participants)
      .where(eq(participants.eventId, eventId));
    const totalParticipants = pCount?.count ?? 0;

    const [sCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(selections)
      .where(eq(selections.eventId, eventId));
    const selectedParticipants = sCount?.count ?? 0;

    const unselectedParticipants = Math.max(0, totalParticipants - selectedParticipants);
    const totalQuota = categoryList.reduce((sum, c) => sum + c.quota, 0);
    const totalRemainingQuota = categoryList.reduce((sum, c) => sum + c.remainingQuota, 0);
    const soldOutCategoriesCount = categoryList.filter((c) => c.remainingQuota <= 0).length;

    return {
      event,
      totalParticipants,
      selectedParticipants,
      unselectedParticipants,
      totalQuota,
      totalRemainingQuota,
      soldOutCategoriesCount,
      categories: categoryList,
    };
  }

  async getParticipants(eventId: string, search?: string): Promise<AdminParticipantItemDto[]> {
    await this.eventsService.getEventById(eventId);

    const conditions = search
      ? and(eq(participants.eventId, eventId), ilike(participants.name, `%${search.trim()}%`))
      : eq(participants.eventId, eventId);

    const rows = await this.db
      .select({
        id: participants.id,
        eventId: participants.eventId,
        name: participants.name,
        createdAt: participants.createdAt,
        selectionId: selections.id,
        categoryId: selections.categoryId,
        categoryName: categories.name,
        selectedAt: selections.selectedAt,
      })
      .from(participants)
      .leftJoin(selections, and(eq(selections.participantId, participants.id), eq(selections.eventId, eventId)))
      .leftJoin(categories, eq(selections.categoryId, categories.id))
      .where(conditions)
      .orderBy(desc(participants.createdAt));

    return rows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      selection: row.selectionId
        ? {
            id: row.selectionId,
            categoryId: row.categoryId!,
            categoryName: row.categoryName ?? 'Kategori Dihapus',
            selectedAt: row.selectedAt!.toISOString(),
          }
        : null,
    }));
  }

  async getSelections(eventId: string): Promise<AdminSelectionItemDto[]> {
    await this.eventsService.getEventById(eventId);

    const rows = await this.db
      .select({
        id: selections.id,
        eventId: selections.eventId,
        participantId: selections.participantId,
        participantName: participants.name,
        categoryId: selections.categoryId,
        categoryName: categories.name,
        selectedAt: selections.selectedAt,
      })
      .from(selections)
      .innerJoin(participants, eq(selections.participantId, participants.id))
      .innerJoin(categories, eq(selections.categoryId, categories.id))
      .where(eq(selections.eventId, eventId))
      .orderBy(desc(selections.selectedAt));

    return rows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      participantId: row.participantId,
      participantName: row.participantName,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      selectedAt: row.selectedAt.toISOString(),
    }));
  }

  async cancelSelection(eventId: string, selectionId: string) {
    let updatedCategoryState: { categoryId: string; remainingQuota: number } | null = null;

    await this.db.transaction(async (tx) => {
      const [selection] = await tx
        .select()
        .from(selections)
        .where(and(eq(selections.id, selectionId), eq(selections.eventId, eventId)));

      if (!selection) {
        throw new NotFoundException('Data pilihan tidak ditemukan.');
      }

      // Delete selection record
      await tx.delete(selections).where(eq(selections.id, selectionId));

      // Restore category remaining_quota atomically, bounded by quota ceiling
      const [updated] = await tx
        .update(categories)
        .set({
          remainingQuota: sql`LEAST(${categories.quota}, ${categories.remainingQuota} + 1)`,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, selection.categoryId))
        .returning();

      if (updated) {
        updatedCategoryState = {
          categoryId: updated.id,
          remainingQuota: updated.remainingQuota,
        };
      }
    });

    // POST-COMMIT: Broadcast quota update to all connected clients
    if (updatedCategoryState) {
      const state = updatedCategoryState as { categoryId: string; remainingQuota: number };
      const status = CategoriesService.computeStatus(state.remainingQuota);
      this.realtimeGateway.broadcastQuotaUpdate(eventId, {
        categoryId: state.categoryId,
        remainingQuota: state.remainingQuota,
        status,
      });
    }

    return {
      success: true,
      message: 'Pilihan berhasil dibatalkan dan kuota telah dikembalikan.',
    };
  }

  async resetCategoryQuota(eventId: string, categoryId: string, targetRemainingQuota?: number) {
    const category = await this.categoriesService.getCategoryById(categoryId);
    if (category.eventId !== eventId) {
      throw new BadRequestException('Kategori tidak terdaftar pada event ini.');
    }

    let newRemaining = category.quota;
    if (targetRemainingQuota !== undefined && targetRemainingQuota !== null) {
      if (targetRemainingQuota < 0 || targetRemainingQuota > category.quota) {
        throw new BadRequestException(`Nilai kuota tersisa harus antara 0 dan ${category.quota}.`);
      }
      newRemaining = targetRemainingQuota;
    }

    const [updated] = await this.db
      .update(categories)
      .set({
        remainingQuota: newRemaining,
        updatedAt: new Date(),
      })
      .where(and(eq(categories.id, categoryId), eq(categories.eventId, eventId)))
      .returning();

    const status = CategoriesService.computeStatus(updated.remainingQuota);
    this.realtimeGateway.broadcastQuotaUpdate(eventId, {
      categoryId: updated.id,
      remainingQuota: updated.remainingQuota,
      status,
    });

    return {
      success: true,
      category: {
        id: updated.id,
        eventId: updated.eventId,
        name: updated.name,
        quota: updated.quota,
        remainingQuota: updated.remainingQuota,
        status,
        isActive: updated.isActive,
      },
    };
  }

  async forceCloseEvent(eventId: string) {
    const updated = await this.eventsService.updateEvent(eventId, {
      status: EventStatus.CLOSED,
      selectionEndsAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Event berhasil ditutup secara paksa (force close).',
      event: updated,
    };
  }

  async exportSelectionsCsv(eventId: string) {
    const event = await this.eventsService.getEventById(eventId);
    const participantList = await this.getParticipants(eventId);

    const sanitizeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;

    const headers = [
      'No',
      'ID Peserta',
      'Nama Peserta',
      'Waktu Daftar',
      'Kategori Terpilih',
      'Waktu Memilih',
      'Status',
    ];

    const rows = participantList.map((p, index) => {
      const hasSelected = !!p.selection;
      return [
        index + 1,
        p.id,
        sanitizeCsv(p.name),
        p.createdAt,
        hasSelected ? sanitizeCsv(p.selection!.categoryName) : '-',
        hasSelected ? p.selection!.selectedAt : '-',
        hasSelected ? 'SUDAH_MEMILIH' : 'BELUM_MEMILIH',
      ].join(',');
    });

    // Add UTF-8 BOM for Excel support
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const safeEventName = event.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const filename = `rekap-konsumsi-${safeEventName}-${new Date().toISOString().slice(0, 10)}.csv`;

    return {
      filename,
      csvContent,
    };
  }

  async checkEventConsistency(eventId: string) {
    const event = await this.eventsService.getEventById(eventId);
    const categoryList = await this.categoriesService.getCategoriesByEvent(eventId, false);

    // Count total selections for this event
    const [selectionCountRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(selections)
      .where(eq(selections.eventId, eventId));
    const totalSelections = selectionCountRow?.count ?? 0;

    // Check for any duplicate participant selections in the event
    const [distinctParticipantRow] = await this.db
      .select({ count: sql<number>`count(distinct ${selections.participantId})::int` })
      .from(selections)
      .where(eq(selections.eventId, eventId));
    const distinctParticipants = distinctParticipantRow?.count ?? 0;

    // Get selections grouped by categoryId
    const selectionsPerCat = await this.db
      .select({
        categoryId: selections.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(selections)
      .where(eq(selections.eventId, eventId))
      .groupBy(selections.categoryId);

    const selectionMap = new Map<string, number>();
    for (const row of selectionsPerCat) {
      selectionMap.set(row.categoryId, row.count);
    }

    const issues: string[] = [];
    const categoryReports: Array<{
      id: string;
      name: string;
      quota: number;
      remainingQuota: number;
      actualSelections: number;
      expectedRemainingQuota: number;
      isConsistent: boolean;
    }> = [];

    let sumSelectionsFromCategories = 0;

    for (const cat of categoryList) {
      const actualSelections = selectionMap.get(cat.id) ?? 0;
      sumSelectionsFromCategories += actualSelections;
      const expectedRemaining = cat.quota - actualSelections;
      const isConsistent = cat.remainingQuota === expectedRemaining && cat.remainingQuota >= 0;

      if (cat.remainingQuota !== expectedRemaining) {
        issues.push(
          `Inkonsistensi kuota pada kategori "${cat.name}" (ID: ${cat.id}): kuota awal ${cat.quota}, pilihan aktual ${actualSelections}, sisa tercatat ${cat.remainingQuota}, seharusnya ${expectedRemaining}.`
        );
      }
      if (cat.remainingQuota < 0) {
        issues.push(
          `Pelanggaran invarian kuota negatif pada kategori "${cat.name}" (ID: ${cat.id}): sisa kuota = ${cat.remainingQuota}.`
        );
      }

      categoryReports.push({
        id: cat.id,
        name: cat.name,
        quota: cat.quota,
        remainingQuota: cat.remainingQuota,
        actualSelections,
        expectedRemainingQuota: expectedRemaining,
        isConsistent,
      });
    }

    if (distinctParticipants !== totalSelections) {
      issues.push(
        `Pelanggaran integritas: terdapat ${totalSelections} total pilihan namun hanya ${distinctParticipants} peserta unik (duplikat terdeteksi).`
      );
    }

    if (sumSelectionsFromCategories !== totalSelections) {
      issues.push(
        `Pelanggaran konsistensi total: jumlah pilihan kategori (${sumSelectionsFromCategories}) tidak sama dengan total rekaman pilihan (${totalSelections}).`
      );
    }

    const isConsistent = issues.length === 0;

    return {
      success: true,
      isConsistent,
      eventId: event.id,
      eventName: event.name,
      checkedAt: new Date().toISOString(),
      issues,
      summary: {
        totalCategories: categoryList.length,
        totalInitialQuota: categoryList.reduce((sum, c) => sum + c.quota, 0),
        totalRemainingQuota: categoryList.reduce((sum, c) => sum + c.remainingQuota, 0),
        totalSelections,
        distinctParticipants,
      },
      categories: categoryReports,
    };
  }
}
