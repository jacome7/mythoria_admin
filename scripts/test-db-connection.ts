import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getMultiDatabaseConfig, getPoolConfig } from "../src/lib/database-config";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    const config = getMultiDatabaseConfig();
    
    // Test backoffice database connection
    const backofficePoolConfig = getPoolConfig(config.backoffice);
    const backofficePool = new Pool(backofficePoolConfig);
    const backofficeDb = drizzle(backofficePool);
    
    console.log('🔗 Connecting to backoffice database...');
    console.log('📍 Host:', backofficePoolConfig.host);
    console.log('🗄️  Database:', backofficePoolConfig.database);
    
    // Test connection with a simple query
    const result = await backofficeDb.execute('SELECT NOW() as current_time');
    console.log('✅ Database connection successful!');
    console.log('⏰ Current time:', result.rows[0].current_time);
    
    // Check if migration table exists (default Drizzle location)
    const migrationCheck = await backofficeDb.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'drizzle' 
        AND table_name = '__drizzle_migrations'
      ) as migrations_table_exists
    `);
    
    console.log('📋 Migration table exists:', migrationCheck.rows[0].migrations_table_exists);
    
    // Check migration status (handle case where table doesn't exist)
    try {
      const migrationStatus = await backofficeDb.execute(`
        SELECT COUNT(*) as migration_count 
        FROM drizzle.__drizzle_migrations
      `);
      console.log('📊 Applied migrations:', migrationStatus.rows[0].migration_count);
    } catch (error) {
      console.log('⚠️  Migration table not found - migrations may not have been run yet');
      
      // Let's also check if there's a custom migration table name
      try {
        const customMigrationStatus = await backofficeDb.execute(`
          SELECT COUNT(*) as migration_count 
          FROM drizzle.drizzle_migrations
        `);
        console.log('📊 Applied migrations (custom table):', customMigrationStatus.rows[0].migration_count);
      } catch (customError) {
        console.log('⚠️  No migration table found in drizzle schema');
      }
    }
    
    // List all tables
    const tables = await backofficeDb.execute(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    console.log('🗂️  Tables in database:');
    tables.rows.forEach(row => {
      console.log('  -', row.tablename);
    });
    
    await backofficePool.end();
    console.log('🎉 Database connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    process.exit(1);
  }
}

testDatabaseConnection();
