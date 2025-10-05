import { TicketService } from '@/lib/ticketing/service';

async function seedTicketingData() {
  console.log('🎫 Starting ticketing data seeding...');

  try {
    // Seed notification configurations
    await TicketService.seedNotificationConfig();
    console.log('✅ Notification configurations seeded successfully');

    console.log('🎉 Ticketing data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding ticketing data:', error);
    throw error;
  }
}

// Run if this file is executed directly
if (require.main === module) {
  seedTicketingData().catch(console.error);
}

export { seedTicketingData };
