import { relations } from 'drizzle-orm';
import { authors, addresses, events } from './authors';
import { stories, storyVersions } from './stories';
import { characters, storyCharacters } from './characters';
import { paymentMethods, payments, credits } from './payments';
import { shippingCodes } from './shipping';
import { creditLedger, authorCreditBalances } from './credits';
import { storyRatings } from './ratings';
import { printProviders, printRequests } from './print';
import { blogPosts, blogPostTranslations } from './blog';
import { faqSections, faqEntries } from './faq';

// -----------------------------------------------------------------------------
// Relations (for type safety with Drizzle ORM queries)
// -----------------------------------------------------------------------------

export const authorsRelations = relations(authors, ({ one, many }) => ({
  paymentMethods: many(paymentMethods),
  addresses: many(addresses),
  stories: many(stories),
  characters: many(characters), // Characters an author created directly
  credits: many(credits),
  payments: many(payments),
  events: many(events),
  creditLedgerEntries: many(creditLedger),
  creditBalance: one(authorCreditBalances, {
    fields: [authors.authorId],
    references: [authorCreditBalances.authorId],
  }),
  storyRatings: many(storyRatings),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one, many }) => ({
  author: one(authors, {
    fields: [paymentMethods.authorId],
    references: [authors.authorId],
  }),
  payments: many(payments),
}));

export const addressesRelations = relations(addresses, ({ one, many }) => ({
  author: one(authors, {
    fields: [addresses.authorId],
    references: [authors.authorId],
  }),
  shippingCodes: many(shippingCodes),
  printRequests: many(printRequests),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
  author: one(authors, {
    fields: [stories.authorId],
    references: [authors.authorId],
  }),
  storyCharacters: many(storyCharacters),
  shippingCodes: many(shippingCodes),
  storyVersions: many(storyVersions),
  creditLedgerEntries: many(creditLedger),
  ratings: many(storyRatings),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  author: one(authors, {
    // If character is directly linked to an author
    fields: [characters.authorId],
    references: [authors.authorId],
  }),
  storyCharacters: many(storyCharacters),
}));

export const storyCharactersRelations = relations(storyCharacters, ({ one }) => ({
  story: one(stories, {
    fields: [storyCharacters.storyId],
    references: [stories.storyId],
  }),
  character: one(characters, {
    fields: [storyCharacters.characterId],
    references: [characters.characterId],
  }),
}));

export const shippingCodesRelations = relations(shippingCodes, ({ one }) => ({
  story: one(stories, {
    fields: [shippingCodes.storyId],
    references: [stories.storyId],
  }),
  address: one(addresses, {
    fields: [shippingCodes.addressId],
    references: [addresses.addressId],
  }),
}));

export const creditsRelations = relations(credits, ({ one }) => ({
  author: one(authors, {
    fields: [credits.authorId],
    references: [authors.authorId],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  author: one(authors, {
    fields: [payments.authorId],
    references: [authors.authorId],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [payments.paymentMethodId],
    references: [paymentMethods.paymentMethodId],
  }),
  shippingCode: one(shippingCodes, {
    fields: [payments.shippingCodeId],
    references: [shippingCodes.shippingCodeId],
  }),
}));

export const storyVersionsRelations = relations(storyVersions, ({ one }) => ({
  story: one(stories, {
    fields: [storyVersions.storyId],
    references: [stories.storyId],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  author: one(authors, {
    fields: [events.authorId],
    references: [authors.authorId],
  }),
}));

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  author: one(authors, {
    fields: [creditLedger.authorId],
    references: [authors.authorId],
  }),
  story: one(stories, {
    fields: [creditLedger.storyId],
    references: [stories.storyId],
  }),
}));

export const authorCreditBalancesRelations = relations(authorCreditBalances, ({ one }) => ({
  author: one(authors, {
    fields: [authorCreditBalances.authorId],
    references: [authors.authorId],
  }),
}));

export const storyRatingsRelations = relations(storyRatings, ({ one }) => ({
  story: one(stories, {
    fields: [storyRatings.storyId],
    references: [stories.storyId],
  }),
  user: one(authors, {
    fields: [storyRatings.userId],
    references: [authors.authorId],
  }),
}));

// Print Relations
export const printProvidersRelations = relations(printProviders, ({ many }) => ({
  printRequests: many(printRequests),
}));

export const printRequestsRelations = relations(printRequests, ({ one }) => ({
  printProvider: one(printProviders, {
    fields: [printRequests.printProviderId],
    references: [printProviders.id],
  }),
  shippingAddress: one(addresses, {
    fields: [printRequests.shippingId],
    references: [addresses.addressId],
  }),
}));

// Blog relations
export const blogPostsRelations = relations(blogPosts, ({ many }) => ({
  translations: many(blogPostTranslations),
}));

export const blogPostTranslationsRelations = relations(blogPostTranslations, ({ one }) => ({
  post: one(blogPosts, {
    fields: [blogPostTranslations.postId],
    references: [blogPosts.id],
  }),
}));

// FAQ relations
export const faqSectionsRelations = relations(faqSections, ({ many }) => ({
  entries: many(faqEntries),
}));

export const faqEntriesRelations = relations(faqEntries, ({ one }) => ({
  section: one(faqSections, {
    fields: [faqEntries.sectionId],
    references: [faqSections.id],
  }),
}));
