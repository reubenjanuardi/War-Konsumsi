import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard.js';
import { EventsService } from '../events/events.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { AdminService } from './admin.service.js';
import { CreateEventDto, UpdateEventDto } from '../events/dto/event.dto.js';
import { CreateCategoryDto, UpdateCategoryDto } from '../categories/dto/category.dto.js';
import { type ResetQuotaDto } from '@war-konsumsi/shared';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Inject(CategoriesService) private readonly categoriesService: CategoriesService,
    @Inject(AdminService) private readonly adminService: AdminService,
  ) {}

  @Post('auth/verify')
  async verifyAuth() {
    return {
      success: true,
      message: 'Autentikasi admin valid.',
    };
  }

  @Get('events')
  async getAllEvents() {
    const eventsList = await this.eventsService.getAllEvents();
    return {
      success: true,
      events: eventsList,
    };
  }

  @Post('events')
  async createEvent(@Body() dto: CreateEventDto) {
    const event = await this.eventsService.createEvent(dto);
    return {
      success: true,
      event,
    };
  }

  @Get('events/:eventId/dashboard')
  async getDashboard(@Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string) {
    const data = await this.adminService.getDashboardStats(eventId);
    return {
      success: true,
      data,
    };
  }

  @Get('events/:eventId/consistency')
  async checkConsistency(@Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string) {
    return this.adminService.checkEventConsistency(eventId);
  }

  @Patch('events/:eventId')
  async updateEvent(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Body() dto: UpdateEventDto,
  ) {
    const event = await this.eventsService.updateEvent(eventId, dto);
    return {
      success: true,
      event,
    };
  }

  @Post('events/:eventId/open')
  async openEvent(@Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string) {
    const event = await this.eventsService.openEvent(eventId);
    return {
      success: true,
      event,
    };
  }

  @Post('events/:eventId/close')
  async closeEvent(@Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string) {
    const event = await this.eventsService.closeEvent(eventId);
    return {
      success: true,
      event,
    };
  }

  @Post('events/:eventId/force-close')
  async forceCloseEvent(@Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string) {
    return this.adminService.forceCloseEvent(eventId);
  }

  @Get('events/:eventId/participants')
  async getParticipants(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Query('search') search?: string,
  ) {
    const participantsList = await this.adminService.getParticipants(eventId, search);
    return {
      success: true,
      participants: participantsList,
    };
  }

  @Get('events/:eventId/selections')
  async getSelections(@Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string) {
    const selectionsList = await this.adminService.getSelections(eventId);
    return {
      success: true,
      selections: selectionsList,
    };
  }

  @Delete('events/:eventId/selections/:selectionId')
  async cancelSelection(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Param('selectionId', new ParseUUIDPipe({ version: '4' })) selectionId: string,
  ) {
    return this.adminService.cancelSelection(eventId, selectionId);
  }

  @Post('events/:eventId/categories')
  async createCategory(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    await this.eventsService.getEventById(eventId);
    const category = await this.categoriesService.createCategory(eventId, dto);
    return {
      success: true,
      category,
    };
  }

  @Patch('events/:eventId/categories/:categoryId')
  async updateCategory(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    await this.eventsService.getEventById(eventId);
    const category = await this.categoriesService.updateCategory(categoryId, dto);
    return {
      success: true,
      category,
    };
  }

  @Post('events/:eventId/categories/:categoryId/reset-quota')
  async resetCategoryQuota(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string,
    @Body() dto: ResetQuotaDto,
  ) {
    return this.adminService.resetCategoryQuota(eventId, categoryId, dto.remainingQuota);
  }

  @Delete('events/:eventId/categories/:categoryId')
  async deleteCategory(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string,
  ) {
    await this.eventsService.getEventById(eventId);
    return this.categoriesService.deleteCategory(eventId, categoryId);
  }

  @Get('events/:eventId/export')
  async exportCsv(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Res() res: Response,
  ) {
    const { filename, csvContent } = await this.adminService.exportSelectionsCsv(eventId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  }
}
