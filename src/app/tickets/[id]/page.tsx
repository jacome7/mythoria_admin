'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getDisplaySubject, getFormattedTicketNumber } from '@/lib/ticketing/utils';
import { formatAdminDateTime } from '@/lib/date-utils';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import type { TicketMetadata, TicketPaymentPackage } from '@/lib/ticketing/types';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const EURO_FORMATTER = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' });

interface Ticket {
  id: string;
  category: 'contact' | 'print_request' | 'payment_request' | 'other';
  type: 'contact' | 'print_request' | 'buy_credits' | 'other';
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high'; // Removed 'urgent' - not supported by database
  description: string;
  customerEmail?: string;
  customerName?: string;
  metadata?: TicketMetadata;
  author?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketComment {
  id: string;
  content: string;
  authorType: 'admin' | 'system';
  authorName: string;
  createdAt: string;
}

export default function TicketDetailPage() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [mbwayActionStatus, setMbwayActionStatus] = useState<'idle' | 'confirming' | 'closing'>(
    'idle',
  );
  const [mbwayActionError, setMbwayActionError] = useState<string | null>(null);
  const [mbwayActionMessage, setMbwayActionMessage] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`);
      if (response.ok) {
        const apiData = await response.json();
        console.log('Individual Ticket API Response:', apiData); // Debug log

        // Transform the ticket data if needed
        if (apiData && apiData.id) {
          const transformedTicket = {
            id: apiData.id.toString(),
            category: apiData.category,
            type: apiData.category, // Map category to type
            subject: apiData.subject,
            status: apiData.status,
            priority: apiData.priority,
            description: apiData.description,
            customerEmail: apiData.metadata?.email,
            customerName: apiData.metadata?.name,
            metadata: apiData.metadata,
            author: apiData.author || null,
            createdAt: apiData.createdAt,
            updatedAt: apiData.updatedAt,
          };

          setTicket(transformedTicket);

          // Transform comments if available
          const transformedComments = (apiData.comments || []).map(
            (comment: { id: number; body: string; authorId?: string; createdAt: string }) => ({
              id: comment.id.toString(),
              content: comment.body,
              authorType: comment.authorId ? 'admin' : 'system',
              authorName: comment.authorId ? 'Admin' : 'System',
              createdAt: comment.createdAt,
            }),
          );

          setComments(transformedComments);
        }
      } else if (response.status === 404) {
        router.push('/tickets');
      } else {
        console.error('Failed to fetch ticket');
      }
    } catch (error) {
      console.error('Error fetching ticket:', error);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, router]);

  useEffect(() => {
    if (!loading && session?.user) {
      fetchTicket();
    }
  }, [loading, session, fetchTicket]);

  const updateTicket = async (updates: Partial<Ticket>) => {
    if (!ticket) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const apiData = await response.json();
        console.log('Update Ticket API Response:', apiData); // Debug log

        // Transform the updated ticket data
        const transformedTicket = {
          id: apiData.id.toString(),
          category: apiData.category,
          type: apiData.category, // Map category to type
          subject: apiData.subject,
          status: apiData.status,
          priority: apiData.priority,
          description: apiData.description,
          customerEmail: apiData.metadata?.email,
          customerName: apiData.metadata?.name,
          metadata: apiData.metadata,
          author: apiData.author || null,
          createdAt: apiData.createdAt,
          updatedAt: apiData.updatedAt,
        };

        setTicket(transformedTicket);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to update ticket:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !session?.user?.name) return;

    setIsAddingComment(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment.trim(),
          authorName: session.user.name,
        }),
      });

      if (response.ok) {
        const apiComment = await response.json();

        // Transform the API response to match our frontend interface
        const transformedComment: TicketComment = {
          id: apiComment.id.toString(),
          content: apiComment.body,
          authorType: apiComment.authorId ? 'admin' : 'system',
          authorName: session.user.name || 'Admin',
          createdAt: apiComment.createdAt,
        };

        setComments([...comments, transformedComment]);
        setNewComment('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to add comment:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsAddingComment(false);
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'badge-error';
      case 'high':
        return 'badge-warning';
      case 'medium':
        return 'badge-info';
      case 'low':
        return 'badge-ghost';
      default:
        return 'badge-ghost';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'open':
        return 'badge-error';
      case 'in_progress':
        return 'badge-warning';
      case 'resolved':
        return 'badge-success';
      case 'closed':
        return 'badge-neutral';
      default:
        return 'badge-ghost';
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'contact':
        return 'badge-primary';
      case 'print_request':
        return 'badge-secondary';
      case 'buy_credits':
        return 'badge-accent';
      default:
        return 'badge-ghost';
    }
  };

  const formatType = (type: string) => {
    switch (type) {
      case 'contact':
        return 'Contact Us';
      case 'print_request':
        return 'Print Request';
      case 'buy_credits':
        return 'Buy Credits';
      case 'other':
        return 'Other';
      default:
        return type;
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatCurrency = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '—';
    }
    return EURO_FORMATTER.format(value);
  };

  const getMbwayStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'badge-success';
      case 'not_received':
        return 'badge-neutral';
      default:
        return 'badge-warning';
    }
  };

  const getMbwayStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Payment confirmed';
      case 'not_received':
        return 'Payment not received';
      default:
        return 'Awaiting payment';
    }
  };

  const renderCreditPackages = (packages: TicketPaymentPackage[] = []) => {
    if (!packages.length) {
      return null;
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-base-300">
        <table className="table table-zebra table-sm">
          <thead>
            <tr>
              <th>Package</th>
              <th>Quantity</th>
              <th>Credits</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg) => (
              <tr key={`${pkg.packageId}-${pkg.totalPrice}`}>
                <td>#{pkg.packageId}</td>
                <td>{pkg.quantity}</td>
                <td>{pkg.credits}</td>
                <td>{formatCurrency(pkg.unitPrice)}</td>
                <td>{formatCurrency(pkg.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMbwayDetails = () => {
    if (
      !ticket ||
      ticket.category !== 'payment_request' ||
      ticket.metadata?.paymentMethod !== 'mbway'
    ) {
      return null;
    }

    const amountValue = ticket.metadata?.amount;
    const creditsValue = ticket.metadata?.credits;
    const amount = typeof amountValue === 'number' ? amountValue : undefined;
    const credits = typeof creditsValue === 'number' ? creditsValue : undefined;
    const packages = ticket.metadata?.creditPackages || [];
    const status = ticket.metadata?.mbwayPayment?.status ?? 'pending';
    const requestedAt = ticket.metadata?.mbwayPayment?.requestedAt || ticket.metadata?.requestedAt;
    const updatedAt = ticket.metadata?.mbwayPayment?.updatedAt;
    const updatedBy = ticket.metadata?.mbwayPayment?.updatedBy;
    const paymentOrderId = ticket.metadata?.mbwayPayment?.paymentOrderId;

    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="card-title text-lg">MB Way Payment Details</h3>
            <span className={`badge ${getMbwayStatusBadgeClass(status)}`}>
              {getMbwayStatusLabel(status)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-base-content/60">Amount</p>
              <p className="text-xl font-semibold">{formatCurrency(amount)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-base-content/60">Credits</p>
              <p className="text-xl font-semibold">{credits ?? '—'}</p>
            </div>
          </div>

          {packages.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium">Credit Packages</p>
              {renderCreditPackages(packages)}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {requestedAt && (
              <div>
                <p className="text-base-content/60">Requested</p>
                <p className="font-medium">{formatAdminDateTime(requestedAt)}</p>
              </div>
            )}
            {updatedAt && (
              <div>
                <p className="text-base-content/60">Last updated</p>
                <p className="font-medium">{formatAdminDateTime(updatedAt)}</p>
                {updatedBy && <p className="text-base-content/70">by {updatedBy}</p>}
              </div>
            )}
            {paymentOrderId && (
              <div>
                <p className="text-base-content/60">Payment Order ID</p>
                <p className="font-mono text-sm">{paymentOrderId}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleMbwayAction = async (action: 'confirmPayment' | 'paymentNotReceived') => {
    if (!ticket) {
      return;
    }

    setMbwayActionError(null);
    setMbwayActionMessage(null);
    setMbwayActionStatus(action === 'confirmPayment' ? 'confirming' : 'closing');

    try {
      const response = await fetch(`/api/tickets/${ticketId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.error || payload?.message || 'Failed to process MB Way action.';
        throw new Error(message);
      }

      await fetchTicket();
      setMbwayActionMessage(
        action === 'confirmPayment'
          ? 'Payment confirmed and credits added.'
          : 'Ticket closed without notifying the customer.',
      );
    } catch (error) {
      const fallback = 'Unable to process MB Way action.';
      setMbwayActionError(error instanceof Error ? error.message : fallback);
    } finally {
      setMbwayActionStatus('idle');
    }
  };

  const renderPrintRequestMetadata = (metadata: TicketMetadata) => {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-lg">Print Request Details</h3>
          <div className="space-y-4">
            {/* User Information */}
            <div>
              <h4 className="font-semibold text-base mb-2">User</h4>
              {metadata.enrichedUser ? (
                <div className="space-y-1 pl-2">
                  <div className="flex flex-col">
                    <span className="text-sm text-base-content/60">User ID:</span>
                    <span className="font-mono text-sm text-base-content/80">
                      {metadata.enrichedUser.userId}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-base-content/60">Email:</span>
                    <Link
                      href={`/users/${metadata.enrichedUser.userId}`}
                      className="text-primary hover:text-primary-focus underline"
                    >
                      {metadata.enrichedUser.email}
                    </Link>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-base-content/60">Name:</span>
                    <span className="text-base-content/80">
                      {metadata.enrichedUser.displayName}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="pl-2 space-y-1">
                  <div className="flex flex-col">
                    <span className="text-sm text-base-content/60">User ID:</span>
                    <span className="font-mono text-sm text-base-content/80">
                      {metadata.storyId || 'N/A'}
                    </span>
                  </div>
                  <span className="text-error text-sm">User information not found</span>
                </div>
              )}
            </div>

            {/* Story Information */}
            <div>
              <h4 className="font-semibold text-base mb-2">Story</h4>
              {metadata.enrichedStory ? (
                <div className="space-y-1 pl-2">
                  <div className="flex flex-col">
                    <span className="text-sm text-base-content/60">Story ID:</span>
                    <span className="font-mono text-sm text-base-content/80">
                      {metadata.enrichedStory.storyId}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-base-content/60">Title:</span>
                    <span className="text-base-content/80 font-medium">
                      {metadata.enrichedStory.title}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="pl-2 space-y-1">
                  <div className="flex flex-col">
                    <span className="text-sm text-base-content/60">Story ID:</span>
                    <span className="font-mono text-sm text-base-content/80">
                      {metadata.storyId || 'N/A'}
                    </span>
                  </div>
                  <span className="text-error text-sm">Story not found</span>
                </div>
              )}
            </div>

            {/* Shipping Address */}
            <div>
              <h4 className="font-semibold text-base mb-2">Shipping Address</h4>
              {metadata.enrichedAddress ? (
                <div className="space-y-1 pl-2">
                  <div className="flex flex-col">
                    <span className="text-sm text-base-content/60">Address ID:</span>
                    <span className="font-mono text-sm text-base-content/80">
                      {metadata.enrichedAddress.addressId}
                    </span>
                  </div>
                  <div className="flex flex-col mt-2">
                    <span className="text-sm text-base-content/60 mb-1">Full Address:</span>
                    <div className="bg-base-200 p-3 rounded text-base-content/90 text-sm">
                      <div>{metadata.enrichedAddress.line1}</div>
                      {metadata.enrichedAddress.line2 && (
                        <div>{metadata.enrichedAddress.line2}</div>
                      )}
                      <div>
                        {metadata.enrichedAddress.city}
                        {metadata.enrichedAddress.stateRegion &&
                          `, ${metadata.enrichedAddress.stateRegion}`}
                      </div>
                      {metadata.enrichedAddress.postalCode && (
                        <div>{metadata.enrichedAddress.postalCode}</div>
                      )}
                      <div>{metadata.enrichedAddress.country}</div>
                      {metadata.enrichedAddress.phone && (
                        <div className="mt-2 pt-2 border-t border-base-300">
                          Phone: {metadata.enrichedAddress.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pl-2 space-y-1">
                  <div className="flex flex-col">
                    <span className="text-sm text-base-content/60">Address ID:</span>
                    <span className="font-mono text-sm text-base-content/80">
                      {(metadata.shippingAddress?.addressId as string | undefined) || 'N/A'}
                    </span>
                  </div>
                  <span className="text-error text-sm">Address not found</span>
                </div>
              )}
            </div>

            {/* Print Format */}
            {metadata.printFormat && (
              <div>
                <h4 className="font-semibold text-base mb-2">Print Format</h4>
                <div className="pl-2">
                  <span className="badge badge-primary badge-lg capitalize">
                    {metadata.printFormat}
                  </span>
                </div>
              </div>
            )}

            {/* Number of Copies */}
            {metadata.numberOfCopies && (
              <div>
                <h4 className="font-semibold text-base mb-2">Number of Copies</h4>
                <div className="pl-2">
                  <span className="badge badge-secondary badge-lg">
                    {metadata.numberOfCopies} {metadata.numberOfCopies === 1 ? 'copy' : 'copies'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMetadata = (metadata: TicketMetadata) => {
    if (!metadata || Object.keys(metadata).length === 0) return null;

    const renderValue = (key: string, value: unknown) => {
      // Check if this is an email field and we have author ID
      if (key === 'email' && typeof value === 'string' && metadata.author?.id) {
        return (
          <Link
            href={`/users/${metadata.author.id}`}
            className="text-primary hover:text-primary-focus underline"
          >
            {value}
          </Link>
        );
      }

      // For complex objects, pretty print them
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }

      return String(value);
    };

    const hiddenKeys = new Set(['creditPackages', 'mbwayPayment']);

    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-lg">Additional Information</h3>
          <div className="space-y-2">
            {Object.entries(metadata)
              .filter(([key]) => !hiddenKeys.has(key))
              .map(([key, value]) => (
                <div key={key} className="flex flex-col sm:flex-row">
                  <span className="font-medium min-w-32 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}:
                  </span>
                  <span className="text-base-content/70 break-words">
                    {renderValue(key, value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto p-4">
          <div className="flex justify-center items-center min-h-[400px]">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto p-4">
          <div className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Ticket Not Found</h1>
            <Link href="/tickets" className="btn btn-primary">
              Back to Tickets
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isMbwayTicket =
    ticket.category === 'payment_request' && ticket.metadata?.paymentMethod === 'mbway';
  const mbwayStatus = ticket.metadata?.mbwayPayment?.status ?? 'pending';
  const terminalTicketStatus = ticket.status === 'resolved' || ticket.status === 'closed';
  const mbwayResolved = mbwayStatus !== 'pending' || terminalTicketStatus;
  const ticketCreatedAtMs = new Date(ticket.createdAt).getTime();
  const nowMs = Date.now();
  const ticketAgeMs = nowMs - ticketCreatedAtMs;
  const paymentNotReceivedAvailableAt = ticketCreatedAtMs + FIVE_DAYS_MS;
  const confirmDisabled = !isMbwayTicket || mbwayResolved || mbwayActionStatus !== 'idle';
  const canMarkNotReceived =
    isMbwayTicket &&
    !terminalTicketStatus &&
    mbwayStatus === 'pending' &&
    ticketAgeMs >= FIVE_DAYS_MS;
  const notReceivedDisabled = !canMarkNotReceived || mbwayActionStatus !== 'idle';
  const daysUntilNotReceived = Math.ceil(
    Math.max(paymentNotReceivedAvailableAt - nowMs, 0) / (24 * 60 * 60 * 1000),
  );
  const humanizedDaysUntilNotReceived = Math.max(daysUntilNotReceived, 1);

  return (
    <div className="min-h-screen bg-base-200">
      <main className="container mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="breadcrumbs text-sm">
            <ul>
              <li>
                <Link href="/tickets">Tickets</Link>
              </li>
              <li>{getFormattedTicketNumber(ticket.id)}</li>
            </ul>
          </div>
          <h1 className="text-3xl font-bold text-base-content">{getDisplaySubject(ticket)}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Details */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`badge ${getTypeBadgeClass(ticket.type)}`}>
                    {formatType(ticket.type)}
                  </span>
                  <span className={`badge ${getStatusBadgeClass(ticket.status)}`}>
                    {formatStatus(ticket.status)}
                  </span>
                  <span className={`badge ${getPriorityBadgeClass(ticket.priority)}`}>
                    {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)} Priority
                  </span>
                </div>

                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p className="text-base-content/90 whitespace-pre-wrap mb-4">
                  {ticket.description}
                </p>

                <div className="text-sm text-base-content/70">
                  <p>Created: {formatAdminDateTime(ticket.createdAt)}</p>
                  <p>Last Updated: {formatAdminDateTime(ticket.updatedAt)}</p>
                </div>
              </div>
            </div>

            {isMbwayTicket && renderMbwayDetails()}

            {/* Metadata */}
            {ticket.metadata &&
              (ticket.category === 'print_request'
                ? renderPrintRequestMetadata(ticket.metadata)
                : renderMetadata(ticket.metadata))}

            {/* Comments */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">Comments ({comments.length})</h3>

                {/* Add Comment */}
                <div className="space-y-4">
                  <textarea
                    className="textarea textarea-bordered w-full"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={addComment}
                    disabled={!newComment.trim() || isAddingComment}
                  >
                    {isAddingComment ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      'Add Comment'
                    )}
                  </button>
                </div>

                <div className="divider"></div>

                {/* Comments List */}
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-base-content/70 text-center py-4">No comments yet.</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="bg-base-200 p-4 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{comment.authorName}</span>
                            <span
                              className={`badge badge-sm ${
                                comment.authorType === 'admin' ? 'badge-primary' : 'badge-ghost'
                              }`}
                            >
                              {comment.authorType}
                            </span>
                          </div>
                          <span className="text-sm text-base-content/70">
                            {formatAdminDateTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-base-content/90 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {isMbwayTicket && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body space-y-3">
                  <h3 className="card-title">MB Way Workflow</h3>
                  <p className="text-sm text-base-content/70">
                    Confirm the payment to add credits automatically or close silently if no payment
                    is received after five days.
                  </p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleMbwayAction('confirmPayment')}
                    disabled={confirmDisabled}
                  >
                    {mbwayActionStatus === 'confirming' ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      'Confirm Payment'
                    )}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleMbwayAction('paymentNotReceived')}
                    disabled={notReceivedDisabled}
                  >
                    {mbwayActionStatus === 'closing' ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      'Payment Not Received'
                    )}
                  </button>
                  {!canMarkNotReceived && !terminalTicketStatus && mbwayStatus === 'pending' && (
                    <p className="text-xs text-base-content/60">
                      Available in {humanizedDaysUntilNotReceived} day
                      {humanizedDaysUntilNotReceived === 1 ? '' : 's'} to avoid cancelling active
                      payments.
                    </p>
                  )}
                  {mbwayActionError && <p className="text-error text-sm">{mbwayActionError}</p>}
                  {mbwayActionMessage && (
                    <p className="text-success text-sm">{mbwayActionMessage}</p>
                  )}
                </div>
              </div>
            )}

            {/* Customer/Author Info */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">Customer Information</h3>
                <div className="space-y-2">
                  {/* Show author information if available */}
                  {ticket.author && (
                    <>
                      <div>
                        <span className="font-medium">Name:</span>
                        <p className="text-base-content/70">{ticket.author.name}</p>
                      </div>
                      <div>
                        <span className="font-medium">Email:</span>
                        {ticket.author.id ? (
                          <Link
                            href={`/users/${ticket.author.id}`}
                            className="text-primary hover:text-primary-focus underline"
                          >
                            {ticket.author.email}
                          </Link>
                        ) : (
                          <p className="text-base-content/70">{ticket.author.email}</p>
                        )}
                      </div>
                      {ticket.author.phone && (
                        <div>
                          <span className="font-medium">Phone:</span>
                          <p className="text-base-content/70">{ticket.author.phone}</p>
                        </div>
                      )}
                      <div className="divider my-2"></div>
                    </>
                  )}

                  {/* Fallback to metadata if no author information */}
                  {!ticket.author && ticket.customerName && (
                    <div>
                      <span className="font-medium">Name:</span>
                      <p className="text-base-content/70">{ticket.customerName}</p>
                    </div>
                  )}
                  {!ticket.author && ticket.customerEmail && (
                    <div>
                      <span className="font-medium">Email:</span>
                      {ticket.metadata?.author?.id ? (
                        <Link
                          href={`/users/${ticket.metadata.author.id}`}
                          className="text-primary hover:text-primary-focus underline"
                        >
                          {ticket.customerEmail}
                        </Link>
                      ) : (
                        <p className="text-base-content/70">{ticket.customerEmail}</p>
                      )}
                    </div>
                  )}

                  {/* Display phone number from metadata if no author or author has no phone */}
                  {(!ticket.author || !ticket.author.phone) && ticket.metadata && (
                    <>
                      {/* Check for phone in metadata.phone (payment requests) */}
                      {ticket.metadata.phone && (
                        <div>
                          <span className="font-medium">Mobile Phone:</span>
                          <p className="text-base-content/70">{ticket.metadata.phone}</p>
                        </div>
                      )}

                      {/* Check for phone in metadata.author.phone (contact forms) */}
                      {!ticket.metadata.phone && ticket.metadata.author?.phone && (
                        <div>
                          <span className="font-medium">Mobile Phone:</span>
                          <p className="text-base-content/70">{ticket.metadata.author.phone}</p>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <span className="font-medium">Ticket ID:</span>
                    <p className="text-base-content/70 font-mono text-sm">{ticket.id}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">Quick Actions</h3>
                <div className="space-y-2">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Status</span>
                    </label>
                    <select
                      className="select select-bordered select-sm"
                      value={ticket.status}
                      onChange={(e) => updateTicket({ status: e.target.value as Ticket['status'] })}
                      disabled={isUpdating}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Priority</span>
                    </label>
                    <select
                      className="select select-bordered select-sm"
                      value={ticket.priority}
                      onChange={(e) =>
                        updateTicket({ priority: e.target.value as Ticket['priority'] })
                      }
                      disabled={isUpdating}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  {isUpdating && (
                    <div className="flex justify-center py-2">
                      <span className="loading loading-spinner loading-sm"></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
