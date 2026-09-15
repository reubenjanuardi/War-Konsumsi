import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { EventsModule } from '../events/events.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [EventsModule, RealtimeModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
