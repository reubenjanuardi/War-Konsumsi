import { Injectable, Inject } from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import { DRIZZLE_DB, type DrizzleDB } from '../../database/database.module.js';
import { categories } from '../../database/schema/index.js';
import { CategoryStatus, DEFAULT_LIMITED_QUOTA_THRESHOLD, type CategoryDto } from '@war-konsumsi/shared';
import { CategoryNotFoundException } from '../../common/exceptions/business.exception.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
  ) {}

  static computeStatus(remainingQuota: number): CategoryStatus {
    if (remainingQuota <= 0) {
      return CategoryStatus.SOLD_OUT;
    }
    if (remainingQuota === 1) {
      return CategoryStatus.LAST_ONE;
    }
    if (remainingQuota <= DEFAULT_LIMITED_QUOTA_THRESHOLD) {
      return CategoryStatus.LIMITED;
    }
    return CategoryStatus.AVAILABLE;
  }

  async getCategoriesByEvent(eventId: string, onlyActive = true): Promise<CategoryDto[]> {
    const conditions = onlyActive
      ? and(eq(categories.eventId, eventId), eq(categories.isActive, true))
      : eq(categories.eventId, eventId);

    const rows = await this.db
      .select()
      .from(categories)
      .where(conditions)
      .orderBy(asc(categories.name));

    return rows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      name: row.name,
      description: row.description,
      imageUrl: row.imageUrl,
      quota: row.quota,
      remainingQuota: row.remainingQuota,
      status: CategoriesService.computeStatus(row.remainingQuota),
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getCategoryById(categoryId: string): Promise<CategoryDto> {
    const [row] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId));

    if (!row) {
      throw new CategoryNotFoundException();
    }

    return {
      id: row.id,
      eventId: row.eventId,
      name: row.name,
      description: row.description,
      imageUrl: row.imageUrl,
      quota: row.quota,
      remainingQuota: row.remainingQuota,
      status: CategoriesService.computeStatus(row.remainingQuota),
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createCategory(eventId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    const [created] = await this.db
      .insert(categories)
      .values({
        eventId,
        name: dto.name,
        description: dto.description || null,
        imageUrl: dto.imageUrl || null,
        quota: dto.quota,
        remainingQuota: dto.quota,
        isActive: true,
      })
      .returning();

    return this.getCategoryById(created.id);
  }

  async updateCategory(categoryId: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const existing = await this.getCategoryById(categoryId);

    const updateData: Partial<typeof categories.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    if (dto.quota !== undefined) {
      // Adjust remainingQuota proportionately if quota changed
      const diff = dto.quota - existing.quota;
      const newRemaining = Math.max(0, existing.remainingQuota + diff);
      updateData.quota = dto.quota;
      updateData.remainingQuota = newRemaining;
    }

    await this.db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, categoryId));

    const updatedCategory = await this.getCategoryById(categoryId);

    this.realtimeGateway.broadcastQuotaUpdate(updatedCategory.eventId, {
      categoryId: updatedCategory.id,
      remainingQuota: updatedCategory.remainingQuota,
      status: updatedCategory.status,
    });

    return updatedCategory;
  }

  async deleteCategory(eventId: string, categoryId: string) {
    const category = await this.getCategoryById(categoryId);
    if (category.eventId !== eventId) {
      throw new CategoryNotFoundException('Kategori tidak terdaftar pada event ini.');
    }

    await this.db
      .delete(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.eventId, eventId)));

    this.realtimeGateway.broadcastQuotaUpdate(eventId, {
      categoryId,
      remainingQuota: 0,
      status: CategoryStatus.SOLD_OUT,
    });

    return {
      success: true,
      message: `Menu "${category.name}" berhasil dihapus.`,
    };
  }
}
