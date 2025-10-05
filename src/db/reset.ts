import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getMultiDatabaseConfig, getPoolConfig, isVpcDirectEgress } from '@/lib/database-config';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function resetDatabase() {
  console.log('🧹 Starting database reset...');

  try {
    const config = getMultiDatabaseConfig();

    console.log('📊 Database configuration loaded');
    console.log('🔗 VPC Direct Egress:', isVpcDirectEgress());

    // Create connection to backoffice database
    const backofficePoolConfig = getPoolConfig(config.backoffice);
    const backofficePool = new Pool(backofficePoolConfig);
    const backofficeDb = drizzle(backofficePool);

    console.log('🗑️  Dropping existing auth tables...');

    // Drop auth tables in reverse order of dependencies
    const dropQueries = [
      'DROP TABLE IF EXISTS "verificationToken" CASCADE;',
      'DROP TABLE IF EXISTS "session" CASCADE;',
      'DROP TABLE IF EXISTS "account" CASCADE;',
      'DROP TABLE IF EXISTS "user" CASCADE;',
      'DROP TABLE IF EXISTS "drizzle_migrations" CASCADE;',
    ];

    for (const query of dropQueries) {
      try {
        await backofficeDb.execute(sql.raw(query));
        console.log(`✅ Executed: ${query}`);
      } catch {
        console.log(`⚠️  Skipped: ${query} (table might not exist)`);
      }
    }

    console.log('✅ Database reset completed successfully');

    // Close connections
    await backofficePool.end();
    console.log('🔌 Database connections closed');

    console.log('🎉 Database reset completed!');
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Database reset interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Database reset terminated');
  process.exit(0);
});

// Run reset
resetDatabase();
