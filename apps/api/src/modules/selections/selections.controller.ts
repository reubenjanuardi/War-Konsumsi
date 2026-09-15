import { Controller, Post, Get, Param, Body, ParseUUIDPipe, Inject } from '@nestjs/common';
import { SelectionsService } from './selections.service.js';
import { CreateSelectionDto } from './dto/create-selection.dto.js';

@Controller('events/:eventId')
export class SelectionsController {
  constructor(@Inject(SelectionsService) private readonly selectionsService: SelectionsService) {}

  @Post('selections')
  async createSelection(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Body() dto: CreateSelectionDto,
  ) {
    const selection = await this.selectionsService.createSelection(
      eventId,
      dto.participantId,
      dto.categoryId,
    );

    return {
      success: true,
      selection,
    };
  }

  @Get('participants/:participantId/selection')
  async getParticipantSelection(
    @Param('eventId', new ParseUUIDPipe({ version: '4' })) eventId: string,
    @Param('participantId', new ParseUUIDPipe({ version: '4' })) participantId: string,
  ) {
    const result = await this.selectionsService.getParticipantSelection(eventId, participantId);
    return {
      success: true,
      ...result,
    };
  }
}
