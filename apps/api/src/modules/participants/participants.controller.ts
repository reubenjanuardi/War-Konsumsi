import { Controller, Post, Param, Body, ParseUUIDPipe, Inject } from '@nestjs/common';
import { ParticipantsService } from './participants.service.js';
import { JoinEventDto } from './dto/join-event.dto.js';

@Controller('events/:eventId/join')
export class ParticipantsController {
  constructor(@Inject(ParticipantsService) private readonly participantsService: ParticipantsService) {}

  @Post()
  async join(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Body() dto: JoinEventDto,
  ) {
    const participant = await this.participantsService.joinEvent(eventId, dto.name);
    return {
      success: true,
      participant,
    };
  }
}
