import { Controller, Get, Param, ParseUUIDPipe, Inject } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { EventsService } from '../events/events.service.js';

@Controller('events/:eventId/categories')
export class CategoriesController {
  constructor(
    @Inject(CategoriesService) private readonly categoriesService: CategoriesService,
    @Inject(EventsService) private readonly eventsService: EventsService,
  ) {}

  @Get()
  async getCategories(@Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string) {
    // Validate event exists
    await this.eventsService.getEventById(eventId);

    const categories = await this.categoriesService.getCategoriesByEvent(eventId, true);
    return {
      success: true,
      categories,
    };
  }
}
