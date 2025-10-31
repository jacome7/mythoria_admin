/**
 * Lead types for email marketing campaign tracking
 */

export type EmailStatus =
  | 'ready'
  | 'sent'
  | 'open'
  | 'click'
  | 'soft_bounce'
  | 'hard_bounce'
  | 'unsub';

export interface Lead {
  id: string;
  name: string | null;
  email: string;
  mobilePhone: string | null;
  language: string;
  lastEmailSentAt: Date | null;
  emailStatus: EmailStatus;
}

export interface LeadSessionData {
  leadId: string;
  email: string;
  mobilePhone: string | null;
  name: string | null;
  language: string;
  /** Timestamp when the session was first created (for one-time redirect logic) */
  firstAccess: number;
  /** Track if user has been redirected from sign-in to sign-up */
  hasBeenRedirected?: boolean;
}

export interface BounceWebhookPayload {
  lead_id?: string;
  email?: string;
  type: 'hard' | 'soft';
  reason?: string;
}
