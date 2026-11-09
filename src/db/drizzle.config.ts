import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.SQL_HOST || 'localhost',
        user: process.env.SQL_ADMIN_USER || process.env.SQL_USER || 'postgres',
        password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || '',
        database: process.env.SQL_DB_NAME || 'postgres',
        ssl: false,
      },
});
