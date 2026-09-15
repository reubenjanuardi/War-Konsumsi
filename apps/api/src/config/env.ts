import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from monorepo root or local directory
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  databasePoolMax: number;
  jwtSecret: string;
  adminSecret: string;
  appUrl: string;
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/war_konsumsi';
  const databasePoolMax = process.env.DATABASE_POOL_MAX ? parseInt(process.env.DATABASE_POOL_MAX, 10) : 30;
  const port = parseInt(process.env.PORT || '4000', 10);
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars';
  const adminSecret = process.env.ADMIN_SECRET || 'dev-admin-secret';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  return {
    nodeEnv,
    port,
    databaseUrl,
    databasePoolMax,
    jwtSecret,
    adminSecret,
    appUrl,
  };
}
