import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { logger } from '@/lib/logger';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  logger.warn('DATABASE_URL is not set', 'db');
}

// Singleton: reuse the same pool across hot-reloads in development
// to avoid exhausting Postgres connection slots.
const globalForDb = global as unknown as { pgClient: postgres.Sql | undefined };

const client =
  globalForDb.pgClient ??
  postgres(connectionString || '', {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
