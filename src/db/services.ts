import { getMythoriaDb, getWorkflowsDb } from "./index";
import { count, desc, eq, like, asc, sql, or, inArray } from "drizzle-orm";
import { authors, stories, printRequests, creditLedger, authorCreditBalances, creditPackages, pricing } from "./schema";
import { storyGenerationRuns, storyGenerationSteps } from "./schema/workflows";

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
      whereCondition = or(
        like(sql`LOWER(${authors.displayName})`, searchPattern),
        like(sql`LOWER(${authors.email})`, searchPattern),
        like(sql`LOWER(${authors.mobilePhone})`, searchPattern)
      );
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

  // Credit operations
  async getUserCreditBalance(authorId: string) {
    const db = getMythoriaDb();
    const [balance] = await db
      .select()
      .from(authorCreditBalances)
      .where(eq(authorCreditBalances.authorId, authorId));
    return balance?.totalCredits || 0;
  },

  async getUserCreditHistory(authorId: string) {
    const db = getMythoriaDb();
    const history = await db
      .select({
        id: creditLedger.id,
        amount: creditLedger.amount,
        creditEventType: creditLedger.creditEventType,
        createdAt: creditLedger.createdAt,
        storyId: creditLedger.storyId,
        purchaseId: creditLedger.purchaseId,
      })
      .from(creditLedger)
      .where(eq(creditLedger.authorId, authorId))
      .orderBy(desc(creditLedger.createdAt));

    // Calculate balance after each transaction
    const historyWithBalance = [];
    let runningBalance = 0;
    
    // Calculate each entry's balance after
    for (let i = history.length - 1; i >= 0; i--) {
      runningBalance += history[i].amount;
      historyWithBalance.unshift({
        ...history[i],
        balanceAfter: runningBalance,
      });
    }

    return historyWithBalance;
  },

  async assignCreditsToUser(
    authorId: string, 
    amount: number, 
    eventType: 'refund' | 'voucher' | 'promotion'
  ) {
    const db = getMythoriaDb();
    
    try {
      // Insert credit ledger entry
      await db.insert(creditLedger).values({
        authorId,
        amount,
        creditEventType: eventType,
        // createdAt is automatically set by defaultNow()
      });

      // Update author credit balance (or insert if doesn't exist)
      await db
        .insert(authorCreditBalances)
        .values({
          authorId,
          totalCredits: amount,
          // lastUpdated is automatically set by defaultNow()
        })
        .onConflictDoUpdate({
          target: authorCreditBalances.authorId,
          set: {
            totalCredits: sql`${authorCreditBalances.totalCredits} + ${amount}`,
            // lastUpdated is automatically updated
          },
        });

      return true;
    } catch (error) {
      console.error('Error assigning credits:', error);
      throw error;
    }
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

  async getStoriesWithAuthors(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    statusFilter?: string,
    featuredFilter?: string,
    sortBy: 'title' | 'createdAt' | 'status' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;
    
    const whereConditions = [];
    
    // Search filter
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
      whereConditions.push(
        sql`(LOWER(${stories.title}) LIKE ${searchPattern} OR 
             LOWER(${authors.displayName}) LIKE ${searchPattern} OR 
             LOWER(${authors.email}) LIKE ${searchPattern})`
      );
    }
    
    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push(eq(stories.status, statusFilter as 'draft' | 'writing' | 'published'));
    }
    
    // Featured filter
    if (featuredFilter && featuredFilter !== 'all') {
      const isFeatured = featuredFilter === 'featured';
      whereConditions.push(eq(stories.isFeatured, isFeatured));
    }
    
    const orderColumn = sortBy === 'title' ? stories.title :
                       sortBy === 'status' ? stories.status : stories.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);
    
    // Build the query with conditional where clause
    const baseQuery = db.select({
      storyId: stories.storyId,
      title: stories.title,
      status: stories.status,
      chapterCount: stories.chapterCount,
      createdAt: stories.createdAt,
      updatedAt: stories.updatedAt,
      isPublic: stories.isPublic,
      isFeatured: stories.isFeatured,
      pdfUri: stories.pdfUri,
      htmlUri: stories.htmlUri,
      author: {
        authorId: authors.authorId,
        displayName: authors.displayName,
        email: authors.email,
      }
    })
    .from(stories)
    .innerJoin(authors, eq(stories.authorId, authors.authorId));
    
    // Execute query with or without where conditions
    let results;
    if (whereConditions.length > 0) {
      let combinedCondition = whereConditions[0];
      for (let i = 1; i < whereConditions.length; i++) {
        combinedCondition = sql`${combinedCondition} AND ${whereConditions[i]}`;
      }
      
      results = await db.select({
        storyId: stories.storyId,
        title: stories.title,
        status: stories.status,
        chapterCount: stories.chapterCount,
        createdAt: stories.createdAt,
        updatedAt: stories.updatedAt,
        isPublic: stories.isPublic,
        isFeatured: stories.isFeatured,
        pdfUri: stories.pdfUri,
        htmlUri: stories.htmlUri,
        author: {
          authorId: authors.authorId,
          displayName: authors.displayName,
          email: authors.email,
        }
      })
      .from(stories)
      .innerJoin(authors, eq(stories.authorId, authors.authorId))
      .where(combinedCondition)
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);
    } else {
      results = await baseQuery
        .orderBy(orderDirection)
        .limit(limit)
        .offset(offset);
    }
      
    return results;
  },

  async getStoryById(storyId: string) {
    const db = getMythoriaDb();
    const [story] = await db.select().from(stories).where(eq(stories.storyId, storyId));
    return story;
  },

  async getStoryByIdWithAuthor(storyId: string) {
    const db = getMythoriaDb();
    const [story] = await db.select({
      storyId: stories.storyId,
      title: stories.title,
      status: stories.status,
      chapterCount: stories.chapterCount,
      createdAt: stories.createdAt,
      updatedAt: stories.updatedAt,
      isPublic: stories.isPublic,
      isFeatured: stories.isFeatured,
      pdfUri: stories.pdfUri,
      htmlUri: stories.htmlUri,
      plotDescription: stories.plotDescription,
      synopsis: stories.synopsis,
      place: stories.place,
      additionalRequests: stories.additionalRequests,
      targetAudience: stories.targetAudience,
      novelStyle: stories.novelStyle,
      graphicalStyle: stories.graphicalStyle,
      featureImageUri: stories.featureImageUri,
      author: {
        authorId: authors.authorId,
        displayName: authors.displayName,
        email: authors.email,
      }
    })
    .from(stories)
    .innerJoin(authors, eq(stories.authorId, authors.authorId))
    .where(eq(stories.storyId, storyId));
    
    return story;
  },

  async updateStory(storyId: string, updates: Partial<typeof stories.$inferSelect>) {
    const db = getMythoriaDb();
    const [updatedStory] = await db.update(stories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stories.storyId, storyId))
      .returning();
    
    return updatedStory;
  },

  async featureStory(storyId: string, featureImageUri: string) {
    const db = getMythoriaDb();
    const [updatedStory] = await db.update(stories)
      .set({ 
        isFeatured: true, 
        featureImageUri: featureImageUri,
        updatedAt: new Date() 
      })
      .where(eq(stories.storyId, storyId))
      .returning();
    
    // Return the story with author information
    if (updatedStory) {
      return await this.getStoryByIdWithAuthor(storyId);
    }
    
    return null;
  },

  async unfeatureStory(storyId: string) {
    const db = getMythoriaDb();
    const [updatedStory] = await db.update(stories)
      .set({ 
        isFeatured: false,
        updatedAt: new Date() 
        // Note: We keep the featureImageUri for future reference
      })
      .where(eq(stories.storyId, storyId))
      .returning();
    
    // Return the story with author information
    if (updatedStory) {
      return await this.getStoryByIdWithAuthor(storyId);
    }
    
    return null;
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
  },

  // Credit Package operations
  async getCreditPackages(
    page: number = 1,
    limit: number = 100,
    sortBy: 'credits' | 'price' | 'createdAt' = 'price',
    sortOrder: 'asc' | 'desc' = 'asc'
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;
    
    const orderColumn = sortBy === 'credits' ? creditPackages.credits :
                       sortBy === 'createdAt' ? creditPackages.createdAt : creditPackages.price;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);
    
    const results = await db.select().from(creditPackages)
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);
      
    return results;
  },

  async getCreditPackageById(packageId: string) {
    const db = getMythoriaDb();
    const [creditPackage] = await db.select().from(creditPackages).where(eq(creditPackages.id, packageId));
    return creditPackage;
  },

  async updateCreditPackage(packageId: string, updates: Partial<typeof creditPackages.$inferSelect>) {
    const db = getMythoriaDb();
    const [updatedPackage] = await db.update(creditPackages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(creditPackages.id, packageId))
      .returning();
    
    return updatedPackage;
  },

  async toggleCreditPackageStatus(packageId: string) {
    const db = getMythoriaDb();
    const currentPackage = await this.getCreditPackageById(packageId);
    if (!currentPackage) return null;

    const [updatedPackage] = await db.update(creditPackages)
      .set({ 
        isActive: !currentPackage.isActive,
        updatedAt: new Date() 
      })
      .where(eq(creditPackages.id, packageId))
      .returning();
    
    return updatedPackage;
  },

  async createCreditPackage(packageData: typeof creditPackages.$inferInsert) {
    const db = getMythoriaDb();
    const [newPackage] = await db.insert(creditPackages)
      .values({
        ...packageData,
        // createdAt and updatedAt are automatically set by defaultNow()
      })
      .returning();
    
    return newPackage;
  },

  async deleteCreditPackage(packageId: string) {
    const db = getMythoriaDb();
    await db.delete(creditPackages).where(eq(creditPackages.id, packageId));
    return true;
  },

  // Pricing Services operations
  async getPricingServices(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    sortBy: 'serviceCode' | 'credits' | 'isActive' | 'createdAt' = 'serviceCode',
    sortOrder: 'asc' | 'desc' = 'asc'
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;
    
    let whereCondition = undefined;
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
      whereCondition = like(sql`LOWER(${pricing.serviceCode})`, searchPattern);
    }
    
    const orderColumn = sortBy === 'credits' ? pricing.credits :
                       sortBy === 'isActive' ? pricing.isActive :
                       sortBy === 'createdAt' ? pricing.createdAt : pricing.serviceCode;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);
    
    const results = await db.select().from(pricing)
      .where(whereCondition)
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);
      
    return results;
  },

  async getPricingServiceById(serviceId: string) {
    const db = getMythoriaDb();
    const [service] = await db.select().from(pricing).where(eq(pricing.id, serviceId));
    return service;
  },

  async updatePricingService(serviceId: string, updates: Partial<typeof pricing.$inferSelect>) {
    const db = getMythoriaDb();
    const [updatedService] = await db.update(pricing)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pricing.id, serviceId))
      .returning();
    
    return updatedService;
  },

  async togglePricingServiceStatus(serviceId: string) {
    const db = getMythoriaDb();
    const currentService = await this.getPricingServiceById(serviceId);
    if (!currentService) return null;

    const [updatedService] = await db.update(pricing)
      .set({ 
        isActive: !currentService.isActive,
        updatedAt: new Date() 
      })
      .where(eq(pricing.id, serviceId))
      .returning();
    
    return updatedService;
  },

  async createPricingService(serviceData: typeof pricing.$inferInsert) {
    const db = getMythoriaDb();
    const [newService] = await db.insert(pricing)
      .values({
        ...serviceData,
        // createdAt and updatedAt are automatically set by defaultNow()
      })
      .returning();
    
    return newService;
  },

  async deletePricingService(serviceId: string) {
    const db = getMythoriaDb();
    await db.delete(pricing).where(eq(pricing.id, serviceId));
    return true;
  },

  // Workflow operations
  async getWorkflowRuns(
    page: number = 1,
    limit: number = 100,
    status?: 'queued' | 'running' | 'failed' | 'completed' | 'cancelled',
    searchTerm?: string,
    sortBy: 'createdAt' | 'startedAt' | 'endedAt' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    const workflowsDb = getWorkflowsDb();
    const mythoriaDb = getMythoriaDb();
    const offset = (page - 1) * limit;
    
    const orderColumn = sortBy === 'startedAt' ? storyGenerationRuns.startedAt :
                       sortBy === 'endedAt' ? storyGenerationRuns.endedAt : 
                       storyGenerationRuns.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);
    
    // First, get workflow runs from workflows database
    let workflowQuery = workflowsDb
      .select({
        runId: storyGenerationRuns.runId,
        storyId: storyGenerationRuns.storyId,
        gcpWorkflowExecution: storyGenerationRuns.gcpWorkflowExecution,
        status: storyGenerationRuns.status,
        currentStep: storyGenerationRuns.currentStep,
        errorMessage: storyGenerationRuns.errorMessage,
        startedAt: storyGenerationRuns.startedAt,
        endedAt: storyGenerationRuns.endedAt,
        metadata: storyGenerationRuns.metadata,
        createdAt: storyGenerationRuns.createdAt,
        updatedAt: storyGenerationRuns.updatedAt,
      })
      .from(storyGenerationRuns);

    // Apply status filter
    if (status) {
      workflowQuery = workflowQuery.where(eq(storyGenerationRuns.status, status)) as typeof workflowQuery;
    }

    // Apply ordering and pagination
    const workflowRuns = await workflowQuery
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);

    // If no workflows found, return empty result
    if (workflowRuns.length === 0) {
      return [];
    }

    // Get story IDs to fetch story details from mythoria database
    const storyIds = workflowRuns.map(run => run.storyId);
    
    // Fetch story and author details from mythoria database
    const storyDetails = await mythoriaDb
      .select({
        storyId: stories.storyId,
        title: stories.title,
        authorName: authors.displayName,
        authorEmail: authors.email,
      })
      .from(stories)
      .innerJoin(authors, eq(stories.authorId, authors.authorId))
      .where(inArray(stories.storyId, storyIds));

    // Create a map for quick lookup
    const storyMap = new Map(storyDetails.map(story => [story.storyId, story]));

    // Combine workflow runs with story details
    const results = workflowRuns.map(run => {
      const story = storyMap.get(run.storyId);
      return {
        run_id: run.runId,
        story_id: run.storyId,
        story_title: story?.title || 'Unknown Story',
        status: run.status,
        started_at: run.startedAt,
        ended_at: run.endedAt,
        user_id: story?.authorEmail || 'Unknown Email',
        error_message: run.errorMessage,
        current_step: run.currentStep,
        step_details: undefined,
        story_details: undefined,
        gcpWorkflowExecution: run.gcpWorkflowExecution,
        // Additional fields that might be useful
        authorName: story?.authorName || 'Unknown Author',
        authorEmail: story?.authorEmail || 'Unknown Email',
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        metadata: run.metadata,
      };
    });

    // Apply search filter in application code (since we need to search across databases)
    if (searchTerm) {
      return results.filter(run => 
        run.story_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.authorName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return results;
  },

  async getWorkflowRunById(runId: string) {
    const workflowsDb = getWorkflowsDb();
    const mythoriaDb = getMythoriaDb();
    
    // Get workflow run from workflows database
    const [workflowRun] = await workflowsDb
      .select({
        runId: storyGenerationRuns.runId,
        storyId: storyGenerationRuns.storyId,
        gcpWorkflowExecution: storyGenerationRuns.gcpWorkflowExecution,
        status: storyGenerationRuns.status,
        currentStep: storyGenerationRuns.currentStep,
        errorMessage: storyGenerationRuns.errorMessage,
        startedAt: storyGenerationRuns.startedAt,
        endedAt: storyGenerationRuns.endedAt,
        metadata: storyGenerationRuns.metadata,
        createdAt: storyGenerationRuns.createdAt,
        updatedAt: storyGenerationRuns.updatedAt,
      })
      .from(storyGenerationRuns)
      .where(eq(storyGenerationRuns.runId, runId));
      
    if (!workflowRun) {
      return null;
    }
    
    // Get story details from mythoria database
    const [storyDetails] = await mythoriaDb
      .select({
        storyId: stories.storyId,
        title: stories.title,
        authorName: authors.displayName,
        authorEmail: authors.email,
      })
      .from(stories)
      .innerJoin(authors, eq(stories.authorId, authors.authorId))
      .where(eq(stories.storyId, workflowRun.storyId));
    
    // Combine the results
    return {
      runId: workflowRun.runId,
      storyId: workflowRun.storyId,
      storyTitle: storyDetails?.title || 'Unknown Story',
      authorName: storyDetails?.authorName || 'Unknown Author',
      authorEmail: storyDetails?.authorEmail || 'Unknown Email',
      gcpWorkflowExecution: workflowRun.gcpWorkflowExecution,
      status: workflowRun.status,
      currentStep: workflowRun.currentStep,
      errorMessage: workflowRun.errorMessage,
      startedAt: workflowRun.startedAt,
      endedAt: workflowRun.endedAt,
      metadata: workflowRun.metadata,
      createdAt: workflowRun.createdAt,
      updatedAt: workflowRun.updatedAt,
    };
  },

  async getWorkflowSteps(runId: string) {
    const workflowsDb = getWorkflowsDb();
    const steps = await workflowsDb
      .select()
      .from(storyGenerationSteps)
      .where(eq(storyGenerationSteps.runId, runId))
      .orderBy(asc(storyGenerationSteps.createdAt));
    
    return steps;
  },

  async getWorkflowRunsCount(status?: 'queued' | 'running' | 'failed' | 'completed' | 'cancelled') {
    const workflowsDb = getWorkflowsDb();
    
    if (status) {
      const result = await workflowsDb
        .select({ value: count() })
        .from(storyGenerationRuns)
        .where(eq(storyGenerationRuns.status, status));
      return result[0]?.value || 0;
    } else {
      const result = await workflowsDb.select({ value: count() }).from(storyGenerationRuns);
      return result[0]?.value || 0;
    }
  },

  async createWorkflowRun(storyId: string, gcpWorkflowExecution?: string, runId?: string) {
    const workflowsDb = getWorkflowsDb();
    const insertData: typeof storyGenerationRuns.$inferInsert = {
      storyId,
      gcpWorkflowExecution,
      status: 'queued',
    };

    if (runId) {
      insertData.runId = runId;
    }

    const [newRun] = await workflowsDb
      .insert(storyGenerationRuns)
      .values(insertData)
      .returning();
    
    return newRun;
  }
};


