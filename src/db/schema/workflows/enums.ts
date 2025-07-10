import { pgEnum } from "drizzle-orm/pg-core";

// Re-export enums needed for workflows database
export const runStatus = pgEnum("run_status", ['queued', 'running', 'failed', 'completed', 'cancelled']);
export const stepStatus = pgEnum("step_status", ['pending', 'running', 'failed', 'completed']);
export const aiActionType = pgEnum("ai_action_type", [
  'story_structure', 
  'story_outline', 
  'chapter_writing', 
  'image_generation', 
  'story_review', 
  'character_generation', 
  'story_enhancement', 
  'audio_generation', 
  'content_validation',
  'image_edit',
  'test'
]);
