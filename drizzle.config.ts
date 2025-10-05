import { defineConfig } from 'drizzle-kit';
import { getMultiDatabaseConfig } from './src/lib/database-config';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Get database configuration
const config = getMultiDatabaseConfig();

export default defineConfig({
  schema: [
    './src/db/schema/auth.ts',
    './src/db/schema/tickets.ts',
    './src/db/schema/credits.ts',
    './src/db/schema/managers.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: config.backoffice.host,
    port: config.backoffice.port,
    user: config.backoffice.user,
    password: config.backoffice.password,
    database: config.backoffice.database,
    ssl: config.backoffice.ssl as boolean,
  },
});
