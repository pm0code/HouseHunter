import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: 'src/lib/db/schema.ts',
  out: 'infra/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ??
      'postgresql://househunter:househunter_dev@localhost:5433/househunter',
  },
});
