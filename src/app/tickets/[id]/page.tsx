'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';
import { getDisplaySubject, getFormattedTicketNumber } from '@/lib/ticketing/utils';
import { formatAdminDateTime } from '@/lib/date-utils';

interface TicketMetadata {
  phone?: string; // For payment requests (MB Way)
  email?: string;
  name?: string;
  amount?: number;
  credits?: number;
  paymentMethod?: string;
  author?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  [key: string]: unknown; // Allow additional fields
}

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
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

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
          const transformedComments = (apiData.comments || []).map((comment: {
            id: number;
            body: string;
            authorId?: string;
            createdAt: string;
          }) => ({
            id: comment.id.toString(),
            content: comment.body,
            authorType: comment.authorId ? 'admin' : 'system',
            authorName: comment.authorId ? 'Admin' : 'System',
            createdAt: comment.createdAt
          }));
          
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
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user) {
      const allowedDomains = ["@mythoria.pt", "@caravanconcierge.com"];
      const isAllowedDomain = allowedDomains.some(domain => 
        session.user?.email?.endsWith(domain)
      );

      if (!isAllowedDomain) {
        router.push('/auth/error');
        return;
      }

      fetchTicket();
    }
  }, [status, session, router, fetchTicket]);

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
          error: errorData
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
          createdAt: apiComment.createdAt
        };
        
        setComments([...comments, transformedComment]);
        setNewComment('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to add comment:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
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
      case 'urgent': return 'badge-error';
      case 'high': return 'badge-warning';
      case 'medium': return 'badge-info';
      case 'low': return 'badge-ghost';
      default: return 'badge-ghost';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'open': return 'badge-error';
      case 'in_progress': return 'badge-warning';
      case 'resolved': return 'badge-success';
      case 'closed': return 'badge-neutral';
      default: return 'badge-ghost';
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'contact': return 'badge-primary';
      case 'print_request': return 'badge-secondary';
      case 'buy_credits': return 'badge-accent';
      default: return 'badge-ghost';
    }
  };

  const formatType = (type: string) => {
    switch (type) {
      case 'contact': return 'Contact Us';
      case 'print_request': return 'Print Request';
      case 'buy_credits': return 'Buy Credits';
      case 'other': return 'Other';
      default: return type;
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'in_progress': return 'In Progress';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
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

    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-lg">Additional Information</h3>
          <div className="space-y-2">
            {Object.entries(metadata).map(([key, value]) => (
              <div key={key} className="flex flex-col sm:flex-row">
                <span className="font-medium min-w-32 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
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

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <AdminHeader />
        <main className="container mx-auto p-4">
          <div className="flex justify-center items-center min-h-[400px]">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </main>
        <AdminFooter />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-base-200">
        <AdminHeader />
        <main className="container mx-auto p-4">
          <div className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Ticket Not Found</h1>
            <Link href="/tickets" className="btn btn-primary">
              Back to Tickets
            </Link>
          </div>
        </main>
        <AdminFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <AdminHeader />
      
      <main className="container mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="breadcrumbs text-sm">
            <ul>
              <li><Link href="/tickets">Tickets</Link></li>
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

            {/* Metadata */}
            {ticket.metadata && renderMetadata(ticket.metadata)}

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
                            <span className={`badge badge-sm ${
                              comment.authorType === 'admin' ? 'badge-primary' : 'badge-ghost'
                            }`}>
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
                      onChange={(e) => updateTicket({ priority: e.target.value as Ticket['priority'] })}
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

      <AdminFooter />
    </div>
  );
}
