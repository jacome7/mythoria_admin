import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { getMultiDatabaseConfig, getPoolConfig, isVpcDirectEgress } from '@/lib/database-config';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runMigrations() {
  console.log('🚀 Starting database migrations...');

  try {
    const config = getMultiDatabaseConfig();

    console.log('📊 Database configuration loaded');
    console.log('🔗 VPC Direct Egress:', isVpcDirectEgress());

    // Create connection to backoffice database for auth tables
    const backofficePoolConfig = getPoolConfig(config.backoffice);
    const backofficePool = new Pool(backofficePoolConfig);
    const backofficeDb = drizzle(backofficePool);

    console.log('🔧 Running migrations for backoffice database (auth tables)...');

    // Run migrations
    await migrate(backofficeDb, {
      migrationsFolder: './drizzle',
      migrationsTable: 'drizzle_migrations',
    });

    console.log('✅ Backoffice database migrations completed successfully');

    // Close connections
    await backofficePool.end();
    console.log('🔌 Database connections closed');

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Migration interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Migration terminated');
  process.exit(0);
});

// Run migrations
runMigrations();
