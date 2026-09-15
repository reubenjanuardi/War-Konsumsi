import { Module } from '@nestjs/common';
import { ParticipantsController } from './participants.controller.js';
import { ParticipantsService } from './participants.service.js';
import { EventsModule } from '../events/events.module.js';

@Module({
  imports: [EventsModule],
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
