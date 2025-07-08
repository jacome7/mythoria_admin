export interface NotificationPayload {
  recipients: string[];
  template: string;
  variables: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, unknown>;
}

export interface NotificationResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

class NotificationClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.NOTIFICATION_ENGINE_URL || 'http://localhost:3002';
    this.apiKey = process.env.NOTIFICATION_ENGINE_API_KEY || '';
  }

  /**
   * Send email notification through the notification engine
   */
  async sendEmail(payload: NotificationPayload): Promise<NotificationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/webhook/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-API-Key': this.apiKey, // Some implementations use this header
        },
        body: JSON.stringify({
          correlationId: `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          data: {
            correlationId: `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            recipients: payload.recipients,
            template: payload.template,
            type: 'email',
            variables: payload.variables,
            priority: payload.priority || 'normal',
            metadata: payload.metadata,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Notification engine error:', errorText);
        return {
          success: false,
          error: `Notification engine returned ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        messageId: result.messageId || result.correlationId,
      };
    } catch (error) {
      console.error('Failed to send notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send ticket creation notification
   */
  async sendTicketCreatedNotification(
    customerEmail: string,
    customerName: string,
    ticket: {
      id: string;
      subject: string;
      type: string;
      priority: string;
      status: string;
      description: string;
      createdAt: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<NotificationResponse> {
    return this.sendEmail({
      recipients: [customerEmail],
      template: 'ticket-created',
      variables: {
        customerName,
        ticketId: ticket.id,
        subject: ticket.subject,
        ticketType: this.formatTicketType(ticket.type),
        priority: this.capitalizeFirst(ticket.priority),
        status: this.capitalizeFirst(ticket.status),
        description: ticket.description,
        createdAt: new Date(ticket.createdAt).toLocaleString(),
        ...ticket.metadata,
      },
      priority: this.mapTicketPriorityToNotificationPriority(ticket.priority),
      metadata: {
        ticketId: ticket.id,
        notificationType: 'ticket-created',
      },
    });
  }

  /**
   * Send ticket status update notification
   */
  async sendTicketStatusUpdateNotification(
    customerEmail: string,
    customerName: string,
    ticket: {
      id: string;
      subject: string;
      type: string;
      priority: string;
      status: string;
      updatedAt: string;
    },
    previousStatus: string,
    statusMessage?: string
  ): Promise<NotificationResponse> {
    return this.sendEmail({
      recipients: [customerEmail],
      template: 'ticket-status-updated',
      variables: {
        customerName,
        ticketId: ticket.id,
        subject: ticket.subject,
        ticketType: this.formatTicketType(ticket.type),
        priority: this.capitalizeFirst(ticket.priority),
        status: this.capitalizeFirst(ticket.status),
        previousStatus: this.capitalizeFirst(previousStatus),
        statusMessage,
        updatedAt: new Date(ticket.updatedAt).toLocaleString(),
      },
      priority: this.mapTicketPriorityToNotificationPriority(ticket.priority),
      metadata: {
        ticketId: ticket.id,
        notificationType: 'ticket-status-updated',
        previousStatus,
        newStatus: ticket.status,
      },
    });
  }

  /**
   * Send new comment notification
   */
  async sendTicketCommentNotification(
    customerEmail: string,
    customerName: string,
    ticket: {
      id: string;
      subject: string;
      type: string;
      priority: string;
      status: string;
    },
    comment: {
      content: string;
      authorName: string;
      authorType: string;
      createdAt: string;
    }
  ): Promise<NotificationResponse> {
    return this.sendEmail({
      recipients: [customerEmail],
      template: 'ticket-comment-added',
      variables: {
        customerName,
        ticketId: ticket.id,
        subject: ticket.subject,
        ticketType: this.formatTicketType(ticket.type),
        priority: this.capitalizeFirst(ticket.priority),
        status: this.capitalizeFirst(ticket.status),
        commentContent: comment.content,
        authorName: comment.authorName,
        authorType: this.capitalizeFirst(comment.authorType),
        commentDate: new Date(comment.createdAt).toLocaleString(),
      },
      priority: this.mapTicketPriorityToNotificationPriority(ticket.priority),
      metadata: {
        ticketId: ticket.id,
        notificationType: 'ticket-comment-added',
        commentAuthor: comment.authorName,
      },
    });
  }

  private formatTicketType(type: string): string {
    switch (type) {
      case 'contact':
        return 'Contact Us';
      case 'print_request':
        return 'Print Request';
      case 'buy_credits':
        return 'Buy Credits';
      default:
        return this.capitalizeFirst(type.replace('_', ' '));
    }
  }

  private capitalizeFirst(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace('_', ' ');
  }

  private mapTicketPriorityToNotificationPriority(
    ticketPriority: string
  ): 'low' | 'normal' | 'high' | 'urgent' {
    switch (ticketPriority) {
      case 'urgent':
        return 'urgent';
      case 'high':
        return 'high';
      case 'medium':
        return 'normal';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }
}

export const notificationClient = new NotificationClient();
