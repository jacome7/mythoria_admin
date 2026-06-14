import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { authors } from './authors';
import type { WritingPersonaPov, WritingPersonaTechnique } from '@/types/writing-persona';

export const writingPersonas = pgTable(
  'writing_personas',
  {
    codename: uuid('codename').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    pov: varchar('pov', { length: 20 }).$type<WritingPersonaPov>().notNull(),
    tone: integer('tone').default(3).notNull(),
    formality: integer('formality').default(3).notNull(),
    rhythm: integer('rhythm').default(3).notNull(),
    vocabulary: integer('vocabulary').default(3).notNull(),
    fictionality: integer('fictionality').default(3).notNull(),
    dialogueDensity: integer('dialogue_density').default(3).notNull(),
    sensoriality: integer('sensoriality').default(3).notNull(),
    subtextIrony: integer('subtext_irony').default(2).notNull(),
    techniques: jsonb('techniques').$type<WritingPersonaTechnique[]>().default([]).notNull(),
    specialRequirements: text('special_requirements').default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    authorIdIdx: index('writing_personas_author_id_idx').on(table.authorId),
    authorIdUpdatedAtIdx: index('writing_personas_author_id_updated_at_idx').on(
      table.authorId,
      table.updatedAt,
    ),
  }),
);

export type WritingPersona = typeof writingPersonas.$inferSelect;
export type NewWritingPersona = typeof writingPersonas.$inferInsert;
