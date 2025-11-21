/**
 * Utility functions for ticket display and formatting
 */

import type { TicketMetadata } from './types';

// Payment request metadata interface
type PaymentRequestMetadata = TicketMetadata & {
  amount?: number;
  credits?: number;
  phone?: string;
  paymentMethod?: string;
};

// Flexible ticket interface for UI components
interface TicketLike {
  id: string;
  category?: string;
  subject: string;
  metadata?: TicketMetadata | null;
}

/**
 * Generate ticket number from UUID - extract 4 digits after first dash
 */
export function getTicketNumber(ticketId: string): string {
  const parts = ticketId.split('-');
  if (parts.length >= 2) {
    return parts[1].toUpperCase();
  }
  // Fallback to original logic if UUID format is unexpected
  return ticketId.replace(/-/g, '').substring(0, 8).toUpperCase();
}

/**
 * Format display subject for tickets, especially MB Way payment tickets
 */
export function getDisplaySubject(ticket: TicketLike): string {
  // For MB Way payment requests, format the subject with ticket number
  if (ticket.category === 'payment_request') {
    const metadata = (ticket.metadata as PaymentRequestMetadata) || {};
    const amount = metadata.amount;
    const credits = metadata.credits;
    const phone = metadata.phone;

    if (amount && credits && phone) {
      const ticketNumber = getTicketNumber(ticket.id);
      return `MB Way Payment request (${ticketNumber}) - ${amount}€ = ${credits} credits - requested by ${phone}`;
    }
  }

  // For other tickets, return the original subject
  return ticket.subject;
}

/**
 * Get formatted ticket number for display
 */
export function getFormattedTicketNumber(ticketId: string): string {
  return `#${getTicketNumber(ticketId)}`;
}
