import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { getMultiDatabaseConfig, getPoolConfig } from "@/lib/database-config";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runTicketsMigration() {
  console.log('🎫 Starting tickets table migration to UUID...');
  
  try {
    const config = getMultiDatabaseConfig();
    
    // Create connection to backoffice database
    const backofficePoolConfig = getPoolConfig(config.backoffice);
    const backofficePool = new Pool(backofficePoolConfig);
    const backofficeDb = drizzle(backofficePool);
    
    console.log('📊 Connected to backoffice database');
    
    // Read the migration SQL file
    const migrationScript = readFileSync(
      join(process.cwd(), 'scripts', 'migrate-tickets-to-uuid.sql'),
      'utf-8'
    );
    
    console.log('📝 Executing migration script...');
    
    // Execute the migration
    const result = await backofficeDb.execute(sql.raw(migrationScript));
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Result:', result);
    
    // Verify the new schema
    console.log('🔍 Verifying new schema...');
    const tableInfo = await backofficeDb.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'tickets' AND column_name = 'id'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Tickets table ID column info:', tableInfo.rows);
    
    // Close connection
    await backofficePool.end();
    console.log('✅ Migration completed successfully!');
    
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

// Run migration
runTicketsMigration();
