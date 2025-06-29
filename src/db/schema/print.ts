import { pgTable, uuid, varchar, timestamp, text, jsonb, boolean } from "drizzle-orm/pg-core";
import { addresses } from './authors';
import { printRequestStatusEnum, printProviderIntegrationEnum } from './enums';

// -----------------------------------------------------------------------------
// Print domain
// -----------------------------------------------------------------------------

// Print Providers
export const printProviders = pgTable("print_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(), // Display name for UI
  companyName: varchar("company_name", { length: 255 }).notNull(),
  vatNumber: varchar("vat_number", { length: 50 }),
  emailAddress: varchar("email_address", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 30 }),
  address: text("address").notNull(),
  postalCode: varchar("postal_code", { length: 20 }),
  city: varchar("city", { length: 120 }).notNull(),
  country: varchar("country", { length: 2 }).notNull(), // ISO 3166-1 alpha-2
  prices: jsonb("prices").notNull(), // JSON with pricing structure
  integration: printProviderIntegrationEnum("integration").notNull().default('email'),
  availableCountries: jsonb("available_countries").notNull(), // Array of ISO 3166-1 alpha-2 country codes
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Print Requests
export const printRequests = pgTable("print_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id").notNull(), // Not FK - story can be deleted but print request persists
  authorId: uuid("author_id").notNull(), // Author who placed the request - for admin tracking
  pdfUrl: text("pdf_url").notNull(), // Public accessible URL to download PDF
  status: printRequestStatusEnum("status").notNull().default('requested'),
  shippingId: uuid("shipping_id").references(() => addresses.addressId, { onDelete: 'set null' }), // FK to addresses table
  printProviderId: uuid("print_provider_id").notNull().references(() => printProviders.id, { onDelete: 'restrict' }),
  printingOptions: jsonb("printing_options").notNull(), // JSON with selected printing options (serviceCode, credits, title, chapterCount, etc.)
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  printedAt: timestamp("printed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type PrintProvider = typeof printProviders.$inferSelect;
export type NewPrintProvider = typeof printProviders.$inferInsert;

export type PrintRequest = typeof printRequests.$inferSelect;
export type NewPrintRequest = typeof printRequests.$inferInsert;
