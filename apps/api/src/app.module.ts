import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { ParticipantsModule } from './modules/participants/participants.module.js';
import { SelectionsModule } from './modules/selections/selections.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    EventsModule,
    CategoriesModule,
    ParticipantsModule,
    SelectionsModule,
    AdminModule,
    RealtimeModule,
  ],
})
export class AppModule {}
