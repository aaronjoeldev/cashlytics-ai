import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { logger } from "@/lib/logger";

const connectionString = process.env.DATABASE_URL;

// The image is built without a database; every build worker would repeat the warning
if (!connectionString && process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
  logger.warn("DATABASE_URL is not set", "db");
}

// Singleton: reuse the same pool across hot-reloads in development
// to avoid exhausting Postgres connection slots.
const globalForDb = global as unknown as { pgClient: postgres.Sql | undefined };

const client =
  globalForDb.pgClient ??
  postgres(connectionString || "", {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
