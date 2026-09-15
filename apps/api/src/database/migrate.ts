import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as path from 'path';
import { getEnvironmentConfig } from '../config/env.js';

export async function runMigrations() {
  const config = getEnvironmentConfig();
  console.log(`⏳ Connecting to database: ${config.databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  const migrationClient = postgres(config.databaseUrl, { max: 1 });
  const db = drizzle(migrationClient);

  // Resolves drizzle/migrations relative to api root or cwd
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle/migrations');
  console.log(`📁 Applying migrations from: ${migrationsFolder}`);

  try {
    await migrate(db, { migrationsFolder });
    console.log('✅ Migrations applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await migrationClient.end();
  }
}

// Allow direct CLI execution
runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
