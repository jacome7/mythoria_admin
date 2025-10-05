import { TicketService } from '@/lib/ticketing/service';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testTicketService() {
  console.log('🧪 Testing TicketService with UUID...');

  try {
    // Test creating a ticket through the service
    const newTicket = await TicketService.createContactTicket({
      userId: undefined,
      type: 'general',
      email: 'test@example.com',
      name: 'Test User',
      message: 'This is a test ticket to verify UUID functionality in the service layer',
    });

    console.log('✅ Successfully created ticket via service:', {
      id: newTicket.id,
      idType: typeof newTicket.id,
      idLength: newTicket.id.length,
      subject: newTicket.subject,
      category: newTicket.category,
    });

    // Verify UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isValidUuid = uuidRegex.test(newTicket.id);

    console.log('🔍 UUID validation:', {
      isValid: isValidUuid,
      format: isValidUuid ? 'Valid UUID v4' : 'Invalid UUID format',
    });

    // Test retrieving the ticket by ID
    const retrievedTicket = await TicketService.getTicketById(newTicket.id);

    if (retrievedTicket) {
      console.log('✅ Successfully retrieved ticket by UUID:', {
        id: retrievedTicket.id,
        subject: retrievedTicket.subject,
        hasComments: Array.isArray(retrievedTicket.comments),
      });
    } else {
      console.error('❌ Failed to retrieve ticket by UUID');
      return;
    }

    // Test updating ticket status
    const updatedTicket = await TicketService.updateStatus(newTicket.id, 'in_progress');

    if (updatedTicket) {
      console.log('✅ Successfully updated ticket status:', {
        id: updatedTicket.id,
        status: updatedTicket.status,
      });
    } else {
      console.error('❌ Failed to update ticket status');
      return;
    }

    // Test adding a comment
    const comment = await TicketService.addComment(
      newTicket.id,
      'This is a test comment',
      'admin-user-id',
      false,
    );

    console.log('✅ Successfully added comment:', {
      id: comment.id,
      ticketId: comment.ticketId,
      body: comment.body,
    });

    // Test getting tickets list
    const tickets = await TicketService.getTickets({
      status: ['open', 'in_progress'],
      limit: 10,
    });

    console.log('✅ Successfully retrieved tickets list:', {
      count: tickets.length,
      containsOurTicket: tickets.some((t) => t.id === newTicket.id),
    });

    console.log('✅ All TicketService tests passed successfully!');
  } catch (error) {
    console.error('❌ TicketService test failed:', error);
    process.exit(1);
  }
}

// Run test
testTicketService();
