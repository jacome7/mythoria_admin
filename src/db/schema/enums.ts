import { pgEnum } from 'drizzle-orm/pg-core';
import { CHARACTER_ROLES, CHARACTER_AGES, CHARACTER_TRAITS } from '../../types/character-enums';

// -----------------------------------------------------------------------------
// Enumerated types
// -----------------------------------------------------------------------------

// Character enums using centralized definitions (type is now free text)
export const characterRoleEnum = pgEnum('character_role', CHARACTER_ROLES);
export const characterAgeEnum = pgEnum('character_age', CHARACTER_AGES);
export const characterTraitEnum = pgEnum('character_trait', CHARACTER_TRAITS);

// Added 'temporary' status to allow ephemeral placeholder stories that can be hidden
// from user lists until real content (characters, structured data) is added.
export const storyStatusEnum = pgEnum('story_status', [
  'temporary',
  'draft',
  'writing',
  'published',
]);
export const audiobookStatusEnum = pgEnum('audiobook_status', [
  'generating',
  'completed',
  'failed',
]);
export const addressTypeEnum = pgEnum('address_type', ['billing', 'delivery']);
export const paymentProviderEnum = pgEnum('payment_provider', [
  'stripe',
  'paypal',
  'revolut',
  'other',
]);
export const creditEventTypeEnum = pgEnum('credit_event_type', [
  'initialCredit',
  'creditPurchase',
  'eBookGeneration',
  'audioBookGeneration',
  'printOrder',
  'selfPrinting',
  'refund',
  'voucher',
  'promotion',
  'textEdit',
  'imageEdit',
]);

// Sharing functionality enums
export const accessLevelEnum = pgEnum('access_level', ['view', 'edit']);
export const collaboratorRoleEnum = pgEnum('collaborator_role', ['editor', 'viewer']);

// Story generation workflow enums
export const runStatusEnum = pgEnum('run_status', [
  'queued',
  'running',
  'failed',
  'completed',
  'cancelled',
]);

export const storyRatingEnum = pgEnum('story_rating', ['1', '2', '3', '4', '5']);

// Story attribute enums
export const targetAudienceEnum = pgEnum('target_audience', [
  'children_0-2', // Babies/Toddlers
  'children_3-6', // Preschoolers
  'children_7-10', // Early Elementary
  'children_11-14', // Middle Grade
  'young_adult_15-17', // Young Adult
  'adult_18+', // Adults
  'all_ages', // All Ages
]);

export const novelStyleEnum = pgEnum('novel_style', [
  'adventure',
  'fantasy',
  'mystery',
  'romance',
  'science_fiction',
  'historical',
  'contemporary',
  'fairy_tale',
  'comedy',
  'drama',
  'horror',
  'thriller',
  'biography',
  'educational',
  'poetry',
  'sports_adventure',
]);

export const graphicalStyleEnum = pgEnum('graphical_style', [
  'cartoon',
  'realistic',
  'watercolor',
  'digital_art',
  'hand_drawn',
  'minimalist',
  'vintage',
  'comic_book',
  'anime',
  'pixar_style',
  'disney_style',
  'sketch',
  'oil_painting',
  'colored_pencil',
]);

export const aiActionTypeEnum = pgEnum('ai_action_type', [
  'story_structure',
  'story_outline',
  'chapter_writing',
  'image_generation',
  'image_edit',
  'story_review',
  'character_generation',
  'story_enhancement',
  'audio_generation',
  'content_validation',
  'test',
]);

// Print request enums
export const printRequestStatusEnum = pgEnum('print_request_status', [
  'requested',
  'in_printing',
  'packing',
  'shipped',
  'delivered',
  'cancelled',
  'error',
]);

export const printProviderIntegrationEnum = pgEnum('print_provider_integration', ['email', 'api']);

// Payment order and event enums
export const paymentOrderStatusEnum = pgEnum('payment_order_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'expired',
]);

export const paymentEventTypeEnum = pgEnum('payment_event_type', [
  'order_created',
  'order_updated',
  'payment_initiated',
  'payment_completed',
  'payment_failed',
  'payment_cancelled',
  'webhook_received',
  'credits_added',
  'refund_initiated',
  'refund_completed',
]);

// Add missing payment enums that exist in database
export const paymentMethodTypeEnum = pgEnum('payment_method_type', [
  'card',
  'revolut_pay',
  'apple_pay',
  'google_pay',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'expired',
]);

export const transactionTypeEnum = pgEnum('transaction_type', ['purchase', 'bonus', 'refund']);

// Onboarding / profile enums
export const genderEnum = pgEnum('gender', ['female', 'male', 'prefer_not_to_say']);

export const literaryAgeEnum = pgEnum('literary_age', [
  'school_age',
  'teen',
  'emerging_adult',
  'experienced_adult',
  'midlife_mentor_or_elder',
]);

export const primaryGoalEnum = pgEnum('primary_goal', [
  'family_keepsake',
  'personalized_gift',
  'child_development',
  'fun_and_creativity',
  'friend_group_memories',
  'company_engagement',
  'other',
]);

export const audienceForStoriesEnum = pgEnum('audience_for_stories', [
  'my_child',
  'family_member',
  'friend_group',
  'myself',
  'a_friend',
  'varies',
]);

// Notification preferences for user communication cadence/content
// 'inspiration' is the default (balanced helpful tips)
export const notificationPreferenceEnum = pgEnum('notification_preference', [
  'essential', // Only critical account & story updates
  'inspiration', // Tips & ideas (default)
  'news', // Product news & special promos
]);
