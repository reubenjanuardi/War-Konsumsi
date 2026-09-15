import { Module } from '@nestjs/common';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [RealtimeModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
