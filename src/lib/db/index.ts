import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://househunter:househunter_dev@localhost:5433/househunter';

// Use a single connection for scripts; Next.js API routes benefit from pooling.
// max: 10 is appropriate for Next.js serverless-style API routes.
const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });

export type Database = typeof db;
