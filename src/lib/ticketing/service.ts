import { getBackofficeDb } from '@/db';
import {
  tickets,
  ticketComments,
  ticketNotificationConfig,
  type Ticket,
  type NewTicket,
  type TicketComment,
  type NewTicketComment,
  type TicketStatus,
  type TicketPriority,
} from '@/db/schema/tickets';
import { eq, desc, sql, and, or, ilike } from 'drizzle-orm';
import { notificationClient } from '@/lib/notifications/client';

// Types for service methods
export interface PaymentRequestMetadata {
  amount?: number;
  credits?: number;
  phone?: string;
  paymentMethod?: string;
  [key: string]: unknown;
}

export interface TicketMetadata extends Record<string, unknown> {
  // Extensible metadata for tickets
  paymentMethod?: string;
  amount?: number;
  credits?: number;
  phone?: string;
  email?: string;
  name?: string;
  author?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface CreateTicketData {
  userId?: string;
  category: string;
  subject: string;
  description: string;
  priority?: TicketPriority;
  metadata?: Record<string, unknown>;
}

export interface CreateContactTicketData {
  email: string;
  name: string;
  type: string; // 'Feature request', 'Bug', 'Story failure', etc.
  message: string;
  userId?: string;
}

export interface CreatePrintTicketData {
  storyId: string;
  userId?: string;
  shippingAddress?: Record<string, unknown>;
  printFormat?: string;
}

export interface CreatePaymentTicketData {
  amount: number;
  userId?: string;
  paymentMethod?: string;
}

export interface TicketFilters {
  status?: TicketStatus[];
  category?: string;
  priority?: TicketPriority;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TicketWithComments extends Ticket {
  comments: TicketComment[];
  author?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
}

export class TicketService {
  /**
   * Generate ticket number from UUID - extract 4 digits after first dash
   */
  static getTicketNumber(ticketId: string): string {
    const parts = ticketId.split('-');
    if (parts.length >= 2) {
      return parts[1].toUpperCase();
    }
    // Fallback to original logic if UUID format is unexpected
    return ticketId.replace(/-/g, '').substring(0, 8).toUpperCase();
  }

  /**
   * Format display subject for MB Way payment tickets
   */
  static getDisplaySubject(ticket: Ticket): string {
    // For MB Way payment requests, format the subject with ticket number
    if (ticket.category === 'payment_request') {
      const metadata = (ticket.metadata as PaymentRequestMetadata) || {};
      const amount = metadata.amount;
      const credits = metadata.credits;
      const phone = metadata.phone;

      if (amount && credits && phone) {
        const ticketNumber = this.getTicketNumber(ticket.id);
        return `MB Way Payment request (${ticketNumber}) - ${amount}€ = ${credits} credits - requested by ${phone}`;
      }
    }

    // For other tickets, return the original subject
    return ticket.subject;
  }

  /**
   * Create a new ticket
   */
  static async createTicket(data: CreateTicketData): Promise<Ticket> {
    const db = getBackofficeDb();

    const newTicket: NewTicket = {
      userId: data.userId || null,
      category: data.category,
      subject: data.subject,
      description: data.description,
      priority: data.priority || 'medium',
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [ticket] = await db.insert(tickets).values(newTicket).returning();

    // Trigger notification
    await this.triggerNotification(ticket.id, 'created');

    return ticket;
  }

  /**
   * Create ticket from contact form
   */
  static async createContactTicket(data: CreateContactTicketData): Promise<Ticket> {
    return this.createTicket({
      userId: data.userId,
      category: 'contact',
      subject: `Contact: ${data.type}`,
      description: data.message,
      metadata: {
        contactType: data.type,
        email: data.email,
        name: data.name,
        author: {
          email: data.email,
          name: data.name,
        },
      },
    });
  }

  /**
   * Create ticket from print request
   */
  static async createPrintTicket(data: CreatePrintTicketData): Promise<Ticket> {
    return this.createTicket({
      userId: data.userId,
      category: 'print_request',
      subject: `Print Request for Story ${data.storyId}`,
      description: `User requested print for story ID: ${data.storyId}`,
      metadata: {
        storyId: data.storyId,
        shippingAddress: data.shippingAddress,
        printFormat: data.printFormat || 'standard',
      },
    });
  }

  /**
   * Create ticket from payment request
   */
  static async createPaymentTicket(data: CreatePaymentTicketData): Promise<Ticket> {
    return this.createTicket({
      userId: data.userId,
      category: 'payment_request',
      subject: `Payment Request - €${data.amount}`,
      description: `User requested payment processing for amount: €${data.amount}`,
      metadata: {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
      },
    });
  }

  /**
   * Get tickets with filtering and pagination
   */
  static async getTickets(filters: TicketFilters = {}): Promise<Ticket[]> {
    const db = getBackofficeDb();

    const {
      status = ['open', 'in_progress'],
      category,
      priority,
      search,
      page = 1,
      limit = 50,
    } = filters;

    // Build where conditions
    const conditions = [];

    if (status.length > 0) {
      conditions.push(or(...status.map((s) => eq(tickets.status, s))));
    }

    if (category) {
      conditions.push(eq(tickets.category, category));
    }

    if (priority) {
      conditions.push(eq(tickets.priority, priority));
    }

    if (search) {
      conditions.push(
        or(ilike(tickets.subject, `%${search}%`), ilike(tickets.description, `%${search}%`)),
      );
    }

    // Build the query
    const offset = (page - 1) * limit;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select()
      .from(tickets)
      .where(whereClause)
      .orderBy(desc(tickets.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get a single ticket by ID with comments
   */
  static async getTicketById(id: string): Promise<TicketWithComments | null> {
    const db = getBackofficeDb();

    // Get ticket from backoffice database
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));

    if (!ticket) {
      return null;
    }

    // Get comments
    const comments = await db
      .select()
      .from(ticketComments)
      .where(eq(ticketComments.ticketId, id))
      .orderBy(ticketComments.createdAt);

    // Extract author information from metadata if available
    const metadata = (ticket.metadata as TicketMetadata) || {};
    const author = metadata.author
      ? {
          id: metadata.author.id || ticket.userId || '',
          name: metadata.author.name || '',
          email: metadata.author.email || '',
          phone: metadata.author.phone || undefined,
        }
      : null;

    return {
      ...ticket,
      comments,
      author,
    };
  }

  /**
   * Update ticket status
   */
  static async updateStatus(
    ticketId: string,
    status: TicketStatus,
  ): Promise<TicketWithComments | null> {
    const db = getBackofficeDb();

    const updateData: Partial<NewTicket> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
    }

    const [updatedTicket] = await db
      .update(tickets)
      .set(updateData)
      .where(eq(tickets.id, ticketId))
      .returning();

    if (updatedTicket) {
      // Trigger notification for status change
      await this.triggerNotification(ticketId, status);

      // Return the full ticket with author information
      return await this.getTicketById(ticketId);
    }

    return null;
  }

  /**
   * Update ticket priority
   */
  static async updatePriority(
    ticketId: string,
    priority: TicketPriority,
  ): Promise<TicketWithComments | null> {
    const db = getBackofficeDb();

    const [updatedTicket] = await db
      .update(tickets)
      .set({
        priority,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId))
      .returning();

    if (updatedTicket) {
      // Return the full ticket with author information
      return await this.getTicketById(ticketId);
    }

    return null;
  }

  /**
   * Add comment to ticket
   */
  static async addComment(
    ticketId: string,
    body: string,
    authorId: string | null,
    isInternal: boolean = false,
  ): Promise<TicketComment> {
    const db = getBackofficeDb();

    const newComment: NewTicketComment = {
      ticketId,
      authorId,
      body,
      isInternal,
      createdAt: new Date(),
    };

    const [comment] = await db.insert(ticketComments).values(newComment).returning();

    // Update ticket updated_at timestamp
    await db.update(tickets).set({ updatedAt: new Date() }).where(eq(tickets.id, ticketId));

    return comment;
  }

  /**
   * Get ticket metrics for dashboard
   */
  static async getMetrics(): Promise<{
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    urgentTickets: number;
  }> {
    const db = getBackofficeDb();

    // Get total counts by status
    const statusCounts = await db
      .select({
        status: tickets.status,
        count: sql<number>`count(*)::int`,
      })
      .from(tickets)
      .groupBy(tickets.status);

    // Get urgent tickets count (high priority tickets)
    const urgentResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(tickets)
      .where(eq(tickets.priority, 'high'));

    // Process results
    const statusMap = statusCounts.reduce(
      (acc, { status, count }) => {
        acc[status] = count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalTickets = Object.values(statusMap).reduce((sum, count) => sum + count, 0);

    return {
      totalTickets,
      openTickets: statusMap.open || 0,
      inProgressTickets: statusMap.in_progress || 0,
      resolvedTickets: statusMap.resolved || 0,
      urgentTickets: urgentResult[0]?.count || 0,
    };
  }

  /**
   * Seed default notification configurations
   */
  static async seedNotificationConfig(): Promise<void> {
    const db = getBackofficeDb();

    const configs = [
      {
        category: 'contact',
        ticketEvent: 'created',
        emailTemplate: 'ticket_created',
        sendToCustomer: true,
        enabled: true,
      },
      {
        category: 'contact',
        ticketEvent: 'resolved',
        emailTemplate: 'ticket_resolved',
        sendToCustomer: true,
        enabled: true,
      },
      {
        category: 'print_request',
        ticketEvent: 'created',
        emailTemplate: 'print_request_received',
        sendToCustomer: true,
        enabled: true,
      },
      {
        category: 'print_request',
        ticketEvent: 'resolved',
        emailTemplate: 'print_request_completed',
        sendToCustomer: true,
        enabled: true,
      },
      {
        category: 'payment_request',
        ticketEvent: 'created',
        emailTemplate: 'payment_request_received',
        sendToCustomer: true,
        enabled: true,
      },
    ];

    for (const config of configs) {
      await db.insert(ticketNotificationConfig).values(config).onConflictDoNothing();
    }
  }

  /**
   * Trigger notification for ticket events
   */
  private static async triggerNotification(ticketId: string, event: string): Promise<void> {
    try {
      const ticket = await this.getTicketById(ticketId);
      if (!ticket) {
        console.warn(`Ticket ${ticketId} not found for notification`);
        return;
      }

      // Get customer email and name from metadata
      const metadata = (ticket.metadata as TicketMetadata) || {};
      const customerEmail = metadata.email;
      const customerName = metadata.name;

      if (!customerEmail) {
        console.log(`No customer email for ticket ${ticketId}, skipping notification`);
        return;
      }

      // Send appropriate notification based on event
      switch (event) {
        case 'created':
          await notificationClient.sendTicketCreatedNotification(
            customerEmail,
            customerName || 'Customer',
            {
              id: ticket.id.toString(),
              subject: ticket.subject,
              type: ticket.category,
              priority: ticket.priority,
              status: ticket.status,
              description: ticket.description,
              createdAt: ticket.createdAt.toISOString(),
              metadata: metadata,
            },
          );
          break;

        case 'in_progress':
        case 'resolved':
        case 'closed':
          // For status updates, we need the previous status
          await notificationClient.sendTicketStatusUpdateNotification(
            customerEmail,
            customerName || 'Customer',
            {
              id: ticket.id.toString(),
              subject: ticket.subject,
              type: ticket.category,
              priority: ticket.priority,
              status: ticket.status,
              updatedAt: ticket.updatedAt.toISOString(),
            },
            'open', // We don't track previous status, so assume it was open
          );
          break;

        default:
          console.log(`Unknown notification event: ${event}`);
      }
    } catch (error) {
      console.error(`Failed to send notification for ticket ${ticketId}:`, error);
      // Don't throw the error to avoid breaking the main ticket operation
    }
  }

  /**
   * Send notification for new comment (called from API)
   */
  static async sendCommentNotification(
    ticketId: string,
    comment: TicketComment,
    authorName: string,
  ): Promise<void> {
    try {
      const ticket = await this.getTicketById(ticketId);
      if (!ticket) {
        console.warn(`Ticket ${ticketId} not found for comment notification`);
        return;
      }

      // Skip notification for internal comments
      if (comment.isInternal) {
        return;
      }

      // Get customer email and name from metadata
      const metadata = (ticket.metadata as TicketMetadata) || {};
      const customerEmail = metadata.email;
      const customerName = metadata.name;

      if (!customerEmail) {
        console.log(`No customer email for ticket ${ticketId}, skipping comment notification`);
        return;
      }

      await notificationClient.sendTicketCommentNotification(
        customerEmail,
        customerName || 'Customer',
        {
          id: ticket.id.toString(),
          subject: ticket.subject,
          type: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
        },
        {
          content: comment.body,
          authorName: authorName,
          authorType: 'admin', // Comments from the admin interface are from admins
          createdAt: comment.createdAt.toISOString(),
        },
      );
    } catch (error) {
      console.error(`Failed to send comment notification for ticket ${ticketId}:`, error);
      // Don't throw the error to avoid breaking the main comment operation
    }
  }
}
