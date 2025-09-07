import { pgTable, uuid, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { authors } from "./authors";
import { stories } from "./stories";

// -----------------------------------------------------------------------------
// AI Edits table - tracks AI editing actions for credit billing
// -----------------------------------------------------------------------------

export const aiEdits = pgTable("ai_edits", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id").notNull().references(() => authors.authorId, { onDelete: "cascade" }),
  storyId: uuid("story_id").notNull().references(() => stories.storyId, { onDelete: "cascade" }),
  action: varchar("action", { length: 20 }).notNull().$type<'textEdit' | 'imageEdit'>(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata")
}, (table) => ({
  authorIdIdx: index("ai_edits_author_id_idx").on(table.authorId),
  actionIdx: index("ai_edits_action_idx").on(table.action),
  authorActionIdx: index("ai_edits_author_action_idx").on(table.authorId, table.action)
}));

export type AiEdit = typeof aiEdits.$inferSelect;
export type NewAiEdit = typeof aiEdits.$inferInsert;
