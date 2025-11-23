/**
 * Shared types for intent context system
 */

/**
 * Story intent types for personalization
 */
export type StoryIntent = string;

/**
 * Story recipient types for personalization
 */
export type StoryRecipient = string;

/**
 * Intent context captured from URL parameters or user preferences
 * Used to personalize the homepage gallery and story recommendations
 */
export interface IntentContext {
  intent?: StoryIntent;
  recipient?: StoryRecipient;
}

/**
 * Cookie name for storing intent context
 */
export const INTENT_CONTEXT_COOKIE = 'mythoria_intent_context';

/**
 * Maximum age for intent context cookie (24 hours in seconds)
 */
export const INTENT_CONTEXT_MAX_AGE = 60 * 60 * 24;
