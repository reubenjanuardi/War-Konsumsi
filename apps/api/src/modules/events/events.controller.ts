import { Controller, Get, Param, ParseUUIDPipe, Inject } from '@nestjs/common';
import { EventsService } from './events.service.js';

@Controller('events')
export class EventsController {
  constructor(@Inject(EventsService) private readonly eventsService: EventsService) {}

  @Get('current')
  async getCurrentEvent() {
    const event = await this.eventsService.getCurrentEvent();
    return {
      success: true,
      event,
    };
  }

  @Get(':eventId')
  async getEvent(@Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string) {
    const event = await this.eventsService.getEventById(eventId);
    return {
      success: true,
      event,
    };
  }
}
