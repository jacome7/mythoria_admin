import { PubSub } from '@google-cloud/pubsub';

let pubsub: PubSub | null = null;

const isProduction = process.env.NODE_ENV === 'production';

// picks creds from metadata
const storyTopic = process.env.PUBSUB_TOPIC || 'mythoria-story-requests';
const audiobookTopic = process.env.PUBSUB_AUDIOBOOK_TOPIC || 'mythoria-audiobook-requests';
const printTopic = process.env.PUBSUB_TOPIC_PRINT || 'mythoria-print-requests';

function getPubSubClient(): PubSub {
  if (pubsub) {
    return pubsub;
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT_ID is not configured');
  }

  pubsub = new PubSub({ projectId });
  return pubsub;
}

export async function publishStoryRequest(message: unknown) {
  return publishMessage(storyTopic, message, 'story generation');
}

export async function publishAudiobookRequest(message: unknown) {
  return publishMessage(audiobookTopic, message, 'audiobook generation');
}

export async function publishPrintRequest(message: unknown) {
  return publishMessage(printTopic, message, 'print generation');
}

async function publishMessage(topic: string, message: unknown, type: string) {
  if (!topic) {
    throw new Error(`PUBSUB topic for ${type} is not set`);
  }

  if (!isProduction) {
    console.log(`[pubsub] Publishing ${type} request`, { topic });
  }

  try {
    const client = getPubSubClient();
    const dataBuffer = Buffer.from(JSON.stringify(message));
    const messageId = await client.topic(topic).publishMessage({ data: dataBuffer });

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
