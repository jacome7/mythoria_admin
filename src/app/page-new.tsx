'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '../components/AdminHeader';
import AdminFooter from '../components/AdminFooter';
import KPICard from '../components/KPICard';

interface KPIData {
  users: number;
  stories: number;
  leads: number;
  printRequests: number;
  revenue: number;
}

export default function AdminPortal() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [isLoadingKpis, setIsLoadingKpis] = useState(true);

  useEffect(() => {
    if (status === 'loading') return; // Still loading

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user) {
      // Check if user has the required email domain (already validated in auth.ts)
      const allowedDomains = ["@mythoria.pt", "@caravanconcierge.com"];
      const isAllowedDomain = allowedDomains.some(domain => 
        session.user?.email?.endsWith(domain)
      );

      if (!isAllowedDomain) {
        router.push('/auth/error');
        return;
      }

      // Fetch KPI data if authorized
      fetchKPIs();
    }
  }, [status, session, router]);

  const fetchKPIs = async () => {
    try {
      setIsLoadingKpis(true);
      const response = await fetch('/api/admin/kpis');
      if (response.ok) {
        const data = await response.json();
        setKpis(data);
      } else {
        console.error('Failed to fetch KPIs');
      }
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    } finally {
      setIsLoadingKpis(false);
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
        <h1 className="text-4xl font-bold text-center mb-8">Dashboard</h1>
        <p className="text-center text-gray-600 mb-8">Project main indicators and KPIs</p>
        
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          <KPICard
            title="Users"
            value={kpis?.users || 0}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            }
            href="/users"
            description="Total registered authors"
            isLoading={isLoadingKpis}
          />
          
          <KPICard
            title="Leads"
            value={kpis?.leads || 0}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            href="/leads"
            description="Total email leads collected"
            isLoading={isLoadingKpis}
          />
          
          <KPICard
            title="Stories"
            value={kpis?.stories || 0}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
            href="/stories"
            description="Total created stories"
            isLoading={isLoadingKpis}
          />
          
          <KPICard
            title="Print Requests"
            value={kpis?.printRequests || 0}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            }
            href="/print-requests"
            description="Total print requests"
            isLoading={isLoadingKpis}
          />
          
          <KPICard
            title="Revenue"
            value={`${kpis?.revenue || 6324}€`}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            href="/payments"
            description="Total revenue generated"
            isLoading={isLoadingKpis}
          />
        </div>
      </main>
      <AdminFooter />
    </div>
  );
}
