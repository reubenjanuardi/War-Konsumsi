import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminService } from './admin.service.js';
import { EventsModule } from '../events/events.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [EventsModule, CategoriesModule, RealtimeModule],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
