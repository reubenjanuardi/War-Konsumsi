import { Controller, Get, Inject, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module.js';
import type { DrizzleDB } from '../../database/database.module.js';
import type { HealthResponseDto } from '@war-konsumsi/shared';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  @Get()
  async check(@Res() res: Response) {
    let databaseStatus: 'connected' | 'disconnected' = 'disconnected';
    let isHealthy = false;

    try {
      // Test active database connection with a fast ping query
      await this.db.execute(sql`SELECT 1`);
      databaseStatus = 'connected';
      isHealthy = true;
    } catch {
      databaseStatus = 'disconnected';
      isHealthy = false;
    }

    const payload: HealthResponseDto = {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      database: databaseStatus,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };

    const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(payload);
  }
}
