import { getMythoriaDb } from "./index";
import { count, desc, eq, like, asc } from "drizzle-orm";
import { authors, leads, stories, printRequests } from "./schema";

export const adminService = {
  // KPI operations
  async getTotalAuthorsCount() {
    const db = getMythoriaDb();
    // This assumes the authors table exists in the schema
    // We'll need to import the actual schema
    const result = await db.select({ value: count() }).from(authors);
    return result[0]?.value || 0;
  },

  async getTotalStoriesCount() {
    const db = getMythoriaDb();
    const result = await db.select({ value: count() }).from(stories);
    return result[0]?.value || 0;
  },

  async getTotalLeadsCount() {
    const db = getMythoriaDb();
    const result = await db.select({ value: count() }).from(leads);
    return result[0]?.value || 0;
  },

  async getTotalPrintRequestsCount() {
    const db = getMythoriaDb();
    const result = await db.select({ value: count() }).from(printRequests);
    return result[0]?.value || 0;
  },

  // User operations
  async getUsers(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    sortBy: 'displayName' | 'email' | 'createdAt' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;
    
    let whereCondition = undefined;
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
      whereCondition = like(authors.email, searchPattern);
    }
    
    const orderColumn = sortBy === 'displayName' ? authors.displayName :
                       sortBy === 'email' ? authors.email : authors.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);
    
    const query = db.select().from(authors);
    if (whereCondition) {
      query.where(whereCondition);
    }
    
    const results = await query
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);
      
    return results;
  },

  async getUserById(authorId: string) {
    const db = getMythoriaDb();
    const [user] = await db.select().from(authors).where(eq(authors.authorId, authorId));
    return user;
  },

  // Lead operations
  async getLeads(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    sortBy: 'email' | 'createdAt' | 'notifiedAt' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;
    
    let whereCondition = undefined;
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
      whereCondition = like(leads.email, searchPattern);
    }
    
    const orderColumn = sortBy === 'email' ? leads.email :
                       sortBy === 'notifiedAt' ? leads.notifiedAt : leads.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);
    
    const query = db.select().from(leads);
    if (whereCondition) {
      query.where(whereCondition);
    }
    
    const results = await query
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);
      
    return results;
  },

  // Story operations
  async getStories(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    sortBy: 'title' | 'createdAt' | 'status' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;
    
    let whereCondition = undefined;
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
      whereCondition = like(stories.title, searchPattern);
    }
    
    const orderColumn = sortBy === 'title' ? stories.title :
                       sortBy === 'status' ? stories.status : stories.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);
    
    const query = db.select().from(stories);
    if (whereCondition) {
      query.where(whereCondition);
    }
    
    const results = await query
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);
      
    return results;
  },

  async getStoryById(storyId: string) {
    const db = getMythoriaDb();
    const [story] = await db.select().from(stories).where(eq(stories.storyId, storyId));
    return story;
  },

  // Print Request operations
  async getPrintRequests(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    sortBy: 'requestedAt' | 'status' = 'requestedAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;
    
    // Search functionality can be implemented later
    // const whereCondition = undefined;
    // if (searchTerm && searchTerm.trim()) {
    //   const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
    //   // Search in multiple fields as appropriate
    // }
    
    const orderColumn = sortBy === 'status' ? printRequests.status : printRequests.requestedAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);
    
    const query = db.select().from(printRequests);
    // if (whereCondition) {
    //   query.where(whereCondition);
    // }
    
    const results = await query
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);
      
    return results;
  }
};


