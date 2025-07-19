'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';
import { formatCustomDate } from '@/lib/date-utils';

interface ServiceStatus {
  name: string;
  displayName: string;
  url: string;
  healthEndpoint: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'loading';
  responseTime?: number;
  lastChecked?: string;
  error?: string;
  debugUrl: string;
}

interface ServerStatusResponse {
  services: {
    service: string;
    displayName: string;
    url: string;
    healthEndpoint: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
    responseTime?: number;
    lastChecked?: string;
    error?: string;
  }[];
  timestamp: string;
  totalServices: number;
  healthyServices: number;
}

export default function ServerStatusPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Initialize services - will be populated by API call
  useEffect(() => {
    const initialServices: ServiceStatus[] = [
      {
        name: 'mythoria-webapp',
        displayName: 'Mythoria WebApp',
        url: '',
        healthEndpoint: '',
        status: 'loading',
        debugUrl: '',
      },
      {
        name: 'mythoria-admin',
        displayName: 'Mythoria Admin',
        url: '',
        healthEndpoint: '',
        status: 'loading',
        debugUrl: '',
      },
      {
        name: 'story-generation-workflow',
        displayName: 'Story Generation Workflow',
        url: '',
        healthEndpoint: '',
        status: 'loading',
        debugUrl: '',
      },
      {
        name: 'notification-engine',
        displayName: 'Notification Engine',
        url: '',
        healthEndpoint: '',
        status: 'loading',
        debugUrl: '',
      },
    ];

    setServices(initialServices);
  }, []);

  // Authentication check
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
    }
  }, [status, session, router]);

  // Check service health via backend API
  const checkAllServices = async () => {
    setIsRefreshing(true);
    
    try {
      const response = await fetch('/api/server-status');
      if (response.ok) {
        const data: ServerStatusResponse = await response.json();
        const updatedServices = data.services.map((serviceData) => ({
          name: serviceData.service,
          displayName: serviceData.displayName,
          url: serviceData.url,
          healthEndpoint: serviceData.healthEndpoint,
          status: serviceData.status,
          responseTime: serviceData.responseTime,
          lastChecked: serviceData.lastChecked,
          error: serviceData.error,
          debugUrl: `${serviceData.healthEndpoint}?debug=true`,
        }));
        setServices(updatedServices);
      } else {
        // If API call fails, mark all services as unknown
        setServices(services.map(service => ({
          ...service,
          status: 'unknown' as const,
          error: 'Failed to fetch status from backend',
          lastChecked: new Date().toISOString(),
        })));
      }
    } catch (error) {
      // If API call fails, mark all services as unknown
      setServices(services.map(service => ({
        ...service,
        status: 'unknown' as const,
        error: error instanceof Error ? error.message : 'Network error',
        lastChecked: new Date().toISOString(),
      })));
    }
    
    setIsRefreshing(false);
  };

  // Initial check and auto-refresh
  useEffect(() => {
    if (services.length > 0 && status === 'authenticated') {
      checkAllServices();
    }
  }, [services.length, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      if (status === 'authenticated') {
        checkAllServices();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get status icon and color
  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <div className="w-3 h-3 bg-success rounded-full"></div>;
      case 'unhealthy':
        return <div className="w-3 h-3 bg-error rounded-full"></div>;
      case 'loading':
        return <div className="w-3 h-3 bg-warning rounded-full animate-pulse"></div>;
      default:
        return <div className="w-3 h-3 bg-base-300 rounded-full"></div>;
    }
  };

  const getStatusText = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'Healthy';
      case 'unhealthy':
        return 'Unhealthy';
      case 'loading':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  const getStatusBadgeClass = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'badge-success';
      case 'unhealthy':
        return 'badge-error';
      case 'loading':
        return 'badge-warning';
      default:
        return 'badge-ghost';
    }
  };

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }
  
  // Don't render content if not authorized
  if (status === 'unauthenticated' || !session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">Server Status</h1>
              <p className="text-gray-600">Monitor the health and performance of all Mythoria services</p>
            </div>
            <div className="flex gap-4">
              {/* Auto-refresh toggle */}
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text mr-2">Auto-refresh</span>
                  <input 
                    type="checkbox" 
                    className="toggle toggle-primary" 
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                </label>
              </div>
              {/* Manual refresh button */}
              <button 
                className={`btn btn-primary ${isRefreshing ? 'loading' : ''}`}
                onClick={checkAllServices}
                disabled={isRefreshing}
              >
                {!isRefreshing && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Refresh
              </button>
            </div>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((service) => (
              <div key={service.name} className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  {/* Service Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(service.status)}
                      <h2 className="card-title">{service.displayName}</h2>
                    </div>
                    <div className={`badge ${getStatusBadgeClass(service.status)}`}>
                      {getStatusText(service.status)}
                    </div>
                  </div>

                  {/* Service Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Service URL:</span>
                      <span className="font-mono">{service.url}</span>
                    </div>
                    {service.responseTime && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Response Time:</span>
                        <span className={`font-mono ${service.responseTime > 1000 ? 'text-warning' : 'text-success'}`}>
                          {service.responseTime}ms
                        </span>
                      </div>
                    )}
                    {service.lastChecked && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Checked:</span>
                        <span className="font-mono">
                          {new Date(service.lastChecked).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    {service.error && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Error:</span>
                        <span className="font-mono text-error text-xs">{service.error}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="card-actions justify-end mt-4">
                    <a 
                      href={service.debugUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Debug Info
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Overall Status Summary */}
          <div className="mt-8">
            <div className="stats shadow">
              <div className="stat">
                <div className="stat-title">Healthy Services</div>
                <div className="stat-value text-success">
                  {services.filter(s => s.status === 'healthy').length}
                </div>
                <div className="stat-desc">out of {services.length} total services</div>
              </div>
              <div className="stat">
                <div className="stat-title">Average Response Time</div>
                <div className="stat-value">
                  {services.filter(s => s.responseTime).length > 0 
                    ? Math.round(services.reduce((acc, s) => acc + (s.responseTime || 0), 0) / services.filter(s => s.responseTime).length)
                    : 0}ms
                </div>
                <div className="stat-desc">across all services</div>
              </div>
              <div className="stat">
                <div className="stat-title">Last Update</div>
                <div className="stat-value text-sm">
                  {services.find(s => s.lastChecked) 
                    ? new Date(services.filter(s => s.lastChecked).sort((a, b) => 
                        new Date(b.lastChecked!).getTime() - new Date(a.lastChecked!).getTime()
                      )[0].lastChecked!).toLocaleTimeString()
                    : 'Never'
                  }
                </div>
                <div className="stat-desc">
                  {autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
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
