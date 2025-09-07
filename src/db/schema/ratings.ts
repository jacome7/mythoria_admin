import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { stories } from './stories';
import { authors } from './authors';
import { storyRatingEnum } from './enums';

// -----------------------------------------------------------------------------
// Story Ratings domain
// -----------------------------------------------------------------------------

export const storyRatings = pgTable("story_ratings", {
  ratingId: uuid("rating_id").primaryKey().defaultRandom(),
  storyId: uuid("story_id").notNull().references(() => stories.storyId, { onDelete: 'cascade' }),
  userId: uuid("user_id").references(() => authors.authorId, { onDelete: 'set null' }), // Optional - for anonymous ratings
  rating: storyRatingEnum("rating").notNull(),
  feedback: text("feedback"),
  isAnonymous: boolean("is_anonymous").default(true).notNull(),
  includeNameInFeedback: boolean("include_name_in_feedback").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Export types
export type StoryRating = typeof storyRatings.$inferSelect;
export type InsertStoryRating = typeof storyRatings.$inferInsert;
