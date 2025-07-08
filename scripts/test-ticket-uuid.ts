import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { getMultiDatabaseConfig, getPoolConfig } from "@/lib/database-config";
import { tickets } from "@/db/schema/tickets";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testTicketCreation() {
  console.log('🧪 Testing ticket creation with UUID...');
  
  try {
    const config = getMultiDatabaseConfig();
    
    // Create connection to backoffice database
    const backofficePoolConfig = getPoolConfig(config.backoffice);
    const backofficePool = new Pool(backofficePoolConfig);
    const backofficeDb = drizzle(backofficePool);
    
    console.log('📊 Connected to backoffice database');
    
    // Create a test ticket
    const [newTicket] = await backofficeDb.insert(tickets).values({
      userId: null,
      category: 'contact',
      subject: 'Test Ticket with UUID',
      description: 'This is a test ticket to verify UUID functionality',
      priority: 'medium',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    console.log('✅ Successfully created test ticket:', {
      id: newTicket.id,
      idType: typeof newTicket.id,
      idLength: newTicket.id.length,
      subject: newTicket.subject,
    });
    
    // Verify UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isValidUuid = uuidRegex.test(newTicket.id);
    
    console.log('🔍 UUID validation:', {
      isValid: isValidUuid,
      format: isValidUuid ? 'Valid UUID v4' : 'Invalid UUID format'
    });
    
    // Cleanup: delete the test ticket
    await backofficeDb.delete(tickets).where(eq(tickets.id, newTicket.id));
    console.log('🗑️  Test ticket cleaned up');
    
    // Close connection
    await backofficePool.end();
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testTicketCreation();
