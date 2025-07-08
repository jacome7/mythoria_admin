import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getMultiDatabaseConfig, getPoolConfig } from "@/lib/database-config";
import { managers } from "@/db/schema";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createManagersTable() {
  console.log('🚀 Creating managers table...');
  
  try {
    const config = getMultiDatabaseConfig();
    
    // Create connection to backoffice database
    const backofficePoolConfig = getPoolConfig(config.backoffice);
    const backofficePool = new Pool(backofficePoolConfig);
    const backofficeDb = drizzle(backofficePool);
    
    console.log('🔧 Creating managers table in backoffice database...');
    
    // Create the managers table manually using SQL
    await backofficePool.query(`
      CREATE TABLE IF NOT EXISTS "managers" (
        "manager_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(120) NOT NULL,
        "email" varchar(255) NOT NULL,
        "mobile_phone" varchar(30),
        "role" varchar(100),
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "managers_email_unique" UNIQUE("email")
      );
    `);
    
    console.log('✅ Managers table created successfully');
    
    // Close connections
    await backofficePool.end();
    console.log('🔌 Database connection closed');
    
    console.log('🎉 Managers table setup completed!');
    
  } catch (error) {
    console.error('❌ Table creation failed:', error);
    process.exit(1);
  }
}

// Run the script
createManagersTable();
