import { TicketService } from "@/lib/ticketing/service";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testMetadataHandling() {
  console.log('🧪 Testing metadata handling fix...');
  
  try {
    // Test creating a ticket with metadata through the service
    const newTicket = await TicketService.createContactTicket({
      userId: undefined,
      type: 'general',
      email: 'test@example.com',
      name: 'Test User',
      message: 'Testing metadata handling after UUID migration',
    });
    
    console.log('✅ Successfully created ticket via service:', {
      id: newTicket.id,
      subject: newTicket.subject,
      metadata: newTicket.metadata,
      metadataType: typeof newTicket.metadata,
    });
    
    console.log('✅ Test completed - no JSON parsing errors!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testMetadataHandling();
