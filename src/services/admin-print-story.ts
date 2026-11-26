import { and, asc, desc, eq } from 'drizzle-orm';
import { getMythoriaDb } from '@/db';
import { addresses, authors } from '@/db/schema/authors';
import { stories } from '@/db/schema/stories';
import { premiumEditionSummary } from '@/lib/premium-edition';

export async function getAdminPrintStory(storyId: string, includeCustomerAddress: boolean) {
  const db = getMythoriaDb();
  const [story] = await db
    .select({ authorId: stories.authorId, features: stories.features })
    .from(stories)
    .where(and(eq(stories.storyId, storyId), eq(stories.status, 'published')))
    .limit(1);
  if (!story) return null;

  const edition = premiumEditionSummary(story.features);
  const premiumRevision = edition?.state === 'published' ? edition.revision : undefined;
  if (!includeCustomerAddress) return { premiumRevision };

  const [address] = await db
    .select({
      name: authors.displayName,
      email: authors.email,
      phone_number: addresses.phone,
      street1: addresses.line1,
      street2: addresses.line2,
      city: addresses.city,
      postcode: addresses.postalCode,
      state_code: addresses.stateRegion,
      country_code: addresses.country,
    })
    .from(addresses)
    .innerJoin(authors, eq(addresses.authorId, authors.authorId))
    .where(and(eq(addresses.authorId, story.authorId), eq(addresses.type, 'delivery')))
    .orderBy(desc(addresses.createdAt), asc(addresses.addressId))
    .limit(1);

  const customerAddress = address && {
    ...address,
    name: address.name ?? '',
    phone_number: address.phone_number ?? '',
    street2: address.street2 ?? '',
    postcode: address.postcode ?? '',
    state_code: address.state_code ?? '',
  };
  return { premiumRevision, customerAddress };
}
