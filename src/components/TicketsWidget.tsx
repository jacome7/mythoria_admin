'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TicketMetrics {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  urgentTickets: number;
}

interface TicketsWidgetProps {
  className?: string;
}

export default function TicketsWidget({ className = '' }: TicketsWidgetProps) {
  const [metrics, setMetrics] = useState<TicketMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/tickets/metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else {
        console.error('Failed to fetch ticket metrics');
      }
    } catch (error) {
      console.error('Error fetching ticket metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`card bg-base-100 shadow-xl ${className}`}>
        <div className="card-body">
          <h2 className="card-title">Customer Tickets</h2>
          <div className="flex justify-center items-center h-32">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={`card bg-base-100 shadow-xl ${className}`}>
        <div className="card-body">
          <h2 className="card-title">Customer Tickets</h2>
          <div className="text-center py-4">
            <p className="text-base-content/70">Unable to load ticket data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card bg-base-100 shadow-xl ${className}`}>
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title">Customer Tickets</h2>
          <Link href="/tickets" className="btn btn-sm btn-primary">
            View All
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="stat bg-base-200 rounded-lg p-3">
            <div className="stat-title text-xs">Total</div>
            <div className="stat-value text-2xl">{metrics.totalTickets}</div>
          </div>
          
          <div className="stat bg-base-200 rounded-lg p-3">
            <div className="stat-title text-xs">Urgent</div>
            <div className="stat-value text-2xl text-error">{metrics.urgentTickets}</div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">Open:</span>
            <span className="badge badge-error badge-sm">{metrics.openTickets}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm">In Progress:</span>
            <span className="badge badge-warning badge-sm">{metrics.inProgressTickets}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm">Resolved:</span>
            <span className="badge badge-success badge-sm">{metrics.resolvedTickets}</span>
          </div>
        </div>

        {(metrics.openTickets > 0 || metrics.urgentTickets > 0) && (
          <div className="alert alert-warning mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs">
              {metrics.urgentTickets > 0 
                ? `${metrics.urgentTickets} urgent ticket${metrics.urgentTickets > 1 ? 's' : ''} need${metrics.urgentTickets === 1 ? 's' : ''} attention`
                : `${metrics.openTickets} open ticket${metrics.openTickets > 1 ? 's' : ''}`
              }
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
