import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

let pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    _db = drizzle(pool, { schema });
  } catch {
    console.warn("[db] Failed to create database pool — running without DB");
  }
} else {
  console.warn("[db] DATABASE_URL not set — running in-memory mode");
}

/** The Drizzle database handle. May be null when no DATABASE_URL is configured. */
export const db = _db;
export { pool };
