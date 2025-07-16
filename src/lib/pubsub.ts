import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

// picks creds from metadata
const storyTopic = process.env.PUBSUB_TOPIC || 'mythoria-story-requests';
const audiobookTopic = process.env.PUBSUB_AUDIOBOOK_TOPIC || 'mythoria-audiobook-requests';

export async function publishStoryRequest(message: unknown) {
  return publishMessage(storyTopic, message, 'story generation');
}

export async function publishAudiobookRequest(message: unknown) {
  return publishMessage(audiobookTopic, message, 'audiobook generation');
}

async function publishMessage(topic: string, message: unknown, type: string) {
  if (!topic) {
    throw new Error(`PUBSUB topic for ${type} is not set`);
  }
  
  // Debug logging to identify the exact configuration being used
  console.log('🔍 DEBUG: Environment variables:');
  console.log('  - Topic:', topic);
  console.log('  - PubSub client project ID:', pubsub.projectId);
  
  console.log(`📢 PUBSUB: Publishing ${type} message to topic:`, topic);
  console.log('📢 PUBSUB: Message payload:', JSON.stringify(message, null, 2));
  
  const dataBuffer = Buffer.from(JSON.stringify(message));
  const messageId = await pubsub.topic(topic).publishMessage({ data: dataBuffer });
  
  console.log(`✅ PUBSUB: ${type} message published successfully with ID:`, messageId);
  return messageId;
}
