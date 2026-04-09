import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

const isProduction = process.env.NODE_ENV === 'production';

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

  if (!isProduction) {
    console.log(`[pubsub] Publishing ${type} request`, { topic });
  }

  try {
    const dataBuffer = Buffer.from(JSON.stringify(message));
    const messageId = await pubsub.topic(topic).publishMessage({ data: dataBuffer });

    if (!isProduction) {
      console.log(`[pubsub] Published ${type} request`, { topic, messageId });
    }

    return messageId;
  } catch (error) {
    console.warn(`[pubsub] Failed to publish ${type} request`, {
      topic,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
