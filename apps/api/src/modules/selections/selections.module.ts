import { Module } from '@nestjs/common';
import { SelectionsController } from './selections.controller.js';
import { SelectionsService } from './selections.service.js';
import { EventsModule } from '../events/events.module.js';
import { ParticipantsModule } from '../participants/participants.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [EventsModule, ParticipantsModule, CategoriesModule, RealtimeModule],
  controllers: [SelectionsController],
  providers: [SelectionsService],
  exports: [SelectionsService],
})
export class SelectionsModule {}
