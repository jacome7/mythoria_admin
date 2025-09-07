import { pgTable, uuid, varchar, timestamp, text, primaryKey, index, json } from "drizzle-orm/pg-core";
import { authors } from './authors';
import { stories } from './stories';
import { characterRoleEnum, characterAgeEnum } from './enums';

// -----------------------------------------------------------------------------
// Characters domain
// -----------------------------------------------------------------------------

// Characters
export const characters = pgTable("characters", {
  characterId: uuid("character_id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").references(() => authors.authorId, { onDelete: 'cascade' }), // Can be null if character is generic
  name: varchar("name", { length: 120 }).notNull(),
  type: varchar("type", { length: 50 }),
  role: characterRoleEnum("role"),
  age: characterAgeEnum("age"), // New age field
  traits: json("traits").$type<string[]>().default([]), // Array of character traits (max 5)
  characteristics: text("characteristics"),
  physicalDescription: text("physical_description"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Indexes for performance optimization
  authorIdIdx: index("characters_author_id_idx").on(table.authorId),
  createdAtIdx: index("characters_created_at_idx").on(table.createdAt),
  roleIdx: index("characters_role_idx").on(table.role),
  ageIdx: index("characters_age_idx").on(table.age), // Index for age field
}));

// Junction table: story ↔ characters (many-to-many)
export const storyCharacters = pgTable("story_characters", {
  storyId: uuid("story_id").notNull().references(() => stories.storyId, { onDelete: 'cascade' }),
  characterId: uuid("character_id").notNull().references(() => characters.characterId, { onDelete: 'cascade' }),
  role: characterRoleEnum("role"),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.storyId, table.characterId] }),
    // Additional indexes for performance
    characterIdIdx: index("story_characters_character_id_idx").on(table.characterId),
  };
});

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

export type StoryCharacter = typeof storyCharacters.$inferSelect;
export type NewStoryCharacter = typeof storyCharacters.$inferInsert;
