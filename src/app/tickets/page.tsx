'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getDisplaySubject, getFormattedTicketNumber } from '@/lib/ticketing/utils';
import { formatAdminDate } from '@/lib/date-utils';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface Ticket {
  id: string;
  category: 'contact' | 'print_request' | 'payment_request' | 'other';
  type: 'contact' | 'print_request' | 'payment_request' | 'other';
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  description: string;
  customerEmail?: string;
  customerName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
}

interface TicketMetrics {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
}

export default function TicketsPage() {
  const { session, loading } = useAdminAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [metrics, setMetrics] = useState<TicketMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  // Removed priority filter per requirements
  const [filterType, setFilterType] = useState<string>('all');

  const fetchTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
  if (filterType !== 'all') params.append('category', filterType); // API uses 'category'

      const response = await fetch(`/api/tickets?${params.toString()}`);
      if (response.ok) {
        const apiData = await response.json();
        console.log('API Response:', apiData); // Debug log
        
        // Transform API data to match frontend interface
        const transformedTickets = (apiData.data || []).map((ticket: {
          id: string;
          category: string;
          subject: string;
          status: string;
          description: string;
          metadata?: { email?: string; name?: string; [key: string]: unknown };
          createdAt: string;
          updatedAt: string;
        }) => ({
          id: ticket.id,
          type: ticket.category as Ticket['type'],
          subject: ticket.subject,
          status: ticket.status as Ticket['status'],
          description: ticket.description,
          customerEmail: ticket.metadata?.email,
          customerName: ticket.metadata?.name,
          metadata: ticket.metadata,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          commentCount: 0
        }));
        
        console.log('Transformed Tickets:', transformedTickets); // Debug log
        setTickets(transformedTickets);
      } else {
        console.error('Failed to fetch tickets:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterType]);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/tickets/metrics');
      if (response.ok) {
        const apiMetrics = await response.json();
        console.log('API Metrics Response:', apiMetrics); // Debug log
        
        // Transform API metrics to match updated frontend interface (no urgent card)
        const transformedMetrics: TicketMetrics = {
          totalTickets: apiMetrics.totalTickets || apiMetrics.total || 0,
          openTickets: apiMetrics.openTickets || apiMetrics.open || 0,
          inProgressTickets: apiMetrics.inProgressTickets || apiMetrics.inProgress || 0,
          resolvedTickets: apiMetrics.resolvedTickets || apiMetrics.resolved || 0,
        };
        
        console.log('Transformed Metrics:', transformedMetrics); // Debug log
        setMetrics(transformedMetrics);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }, []);

  useEffect(() => {
    if (!loading && session?.user) {
      fetchTickets();
      fetchMetrics();
    }
  }, [loading, session, fetchTickets, fetchMetrics]);

  // Priority removed from UI

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
      case 'payment_request': return 'badge-accent';
      default: return 'badge-ghost';
    }
  };

  const formatType = (type: string) => {
    switch (type) {
      case 'contact': return 'Contact Us';
      case 'print_request': return 'Print Request';
      case 'payment_request': return 'Payment Request';
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

  return (
    <div className="min-h-screen bg-base-200">
      
      <main className="container mx-auto p-4">
        <div className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-base-content mb-1 md:mb-2">Customer Tickets</h1>
          <p className="text-base-content/70 text-sm md:text-base">Manage customer support tickets and requests</p>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            <div className="stat bg-base-100 rounded-lg">
              <div className="stat-title">Total Tickets</div>
              <div className="stat-value text-2xl">{metrics.totalTickets}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg">
              <div className="stat-title">Open</div>
              <div className="stat-value text-2xl text-error">{metrics.openTickets}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg">
              <div className="stat-title">In Progress</div>
              <div className="stat-value text-2xl text-warning">{metrics.inProgressTickets}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg">
              <div className="stat-title">Resolved</div>
              <div className="stat-value text-2xl text-success">{metrics.resolvedTickets}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <select 
                  className="select select-bordered"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              
        <div className="form-control">
                <label className="label">
                  <span className="label-text">Type</span>
                </label>
                <select 
                  className="select select-bordered"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="contact">Contact Us</option>
                  <option value="print_request">Print Request</option>
          <option value="payment_request">Payment Request</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Tickets ({tickets.length})</h2>
            
            {tickets.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold mb-2">No tickets found</h3>
                <p className="text-base-content/70">No tickets match your current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Subject</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Customer</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="cursor-pointer hover"
                        onClick={() => { window.location.href = `/tickets/${ticket.id}`; }}
                      >
                        <td className="font-mono text-sm">
                          {getFormattedTicketNumber(ticket.id)}
                        </td>
            <td>
                          <div className="font-medium">{getDisplaySubject(ticket)}</div>
                          {ticket.description && (
              <div className="text-sm text-base-content/70 truncate max-w-[14rem] md:max-w-xs">
                              {ticket.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${getTypeBadgeClass(ticket.type)}`}>
                            {formatType(ticket.type)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadgeClass(ticket.status)}`}>
                            {formatStatus(ticket.status)}
                          </span>
                        </td>
                        <td>
                          {ticket.customerName ? (
                            <div className="font-medium">{ticket.customerName}</div>
                          ) : ticket.customerEmail ? (
                            <div className="font-medium">{ticket.customerEmail}</div>
                          ) : (
                            <span className="text-base-content/50">N/A</span>
                          )}
                        </td>
                        <td className="text-sm">
                          {formatAdminDate(ticket.createdAt)}
                          <br />
                          <span className="text-base-content/70">
                            {new Date(ticket.createdAt).toLocaleTimeString()}
                          </span>
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/tickets/${ticket.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="btn btn-xs btn-outline"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

    </div>
  );
}
