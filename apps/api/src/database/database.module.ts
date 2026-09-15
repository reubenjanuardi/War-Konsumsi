import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnvironmentConfig } from '../config/env.js';
import * as schema from './schema/index.js';

export const DRIZZLE_DB = 'DRIZZLE_DB';
export type DrizzleDB = PostgresJsDatabase<typeof schema>;

let sqlClient: postgres.Sql | null = null;

export const databaseProvider = {
  provide: DRIZZLE_DB,
  useFactory: (): DrizzleDB => {
    const config = getEnvironmentConfig();
    sqlClient = postgres(config.databaseUrl, {
      max: config.databasePoolMax,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    return drizzle(sqlClient, { schema });
  },
};

@Global()
@Module({
  providers: [databaseProvider],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    if (sqlClient) {
      await sqlClient.end();
    }
  }
}
