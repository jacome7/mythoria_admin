import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { getMultiDatabaseConfig, getPoolConfig, isVpcDirectEgress } from '@/lib/database-config';
import { seedTicketingData } from '@/lib/ticketing/seed';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    const config = getMultiDatabaseConfig();

    console.log('📊 Database configuration loaded');
    console.log('🔗 VPC Direct Egress:', isVpcDirectEgress());

    // Create connection to backoffice database
    const backofficePoolConfig = getPoolConfig(config.backoffice);
    const backofficePool = new Pool(backofficePoolConfig);
    const backofficeDb = drizzle(backofficePool);

    console.log('🔧 Seeding backoffice database...');

    // For now, just verify the connection works
    const result = await backofficeDb.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connection verified:', result);

    // Seed ticketing data
    await seedTicketingData();
    console.log('✅ Ticketing data seeded successfully');

    console.log('ℹ️  Additional seed data can be added here when needed');

    // Close connections
    await backofficePool.end();
    console.log('🔌 Database connections closed');

    console.log('🎉 Database seeding completed!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Database seeding interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Database seeding terminated');
  process.exit(0);
});

// Run seeding
seedDatabase();
