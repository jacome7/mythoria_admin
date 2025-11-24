'use client';

import { useCallback, useEffect, useState } from 'react';
import KPICard from '../components/KPICard';
import GrossMarginChart from '@/components/charts/GrossMarginChart';
import NewUsersChart from '@/components/charts/NewUsersChart';
import ServiceUsageChart from '@/components/charts/ServiceUsageChart';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface KPIData {
  users: number;
  stories: number;
  openTickets: number;
}

export default function AdminPortal() {
  const { session, loading } = useAdminAuth();
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [isLoadingKpis, setIsLoadingKpis] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [chartVisibility, setChartVisibility] = useState({
    newUsers: false,
    serviceUsage: false,
    grossMargin: false,
  });

  const fetchKPIs = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoadingKpis(true);
      setKpiError(null);
      const response = await fetch('/api/admin/kpis', {
        signal,
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch KPIs (${response.status})`);
      }
      const data = await response.json();
      if (signal?.aborted) {
        return;
      }
      setKpis(data);
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      console.error('Error fetching KPIs:', error);
      setKpiError('Unable to load KPIs. Please retry in a few seconds.');
    } finally {
      if (!signal?.aborted) {
        setIsLoadingKpis(false);
      }
    }
  }, []);

  useEffect(() => {
    if (loading || !session?.user) {
      return;
    }
    const controller = new AbortController();
    void fetchKPIs(controller.signal);
    return () => controller.abort();
  }, [fetchKPIs, loading, session]);

  useEffect(() => {
    if (!isLoadingKpis && !chartVisibility.newUsers) {
      setChartVisibility((prev) => ({ ...prev, newUsers: true }));
    }
  }, [chartVisibility.newUsers, isLoadingKpis]);

  const handleNewUsersReady = useCallback(() => {
    setChartVisibility((prev) => (prev.serviceUsage ? prev : { ...prev, serviceUsage: true }));
  }, []);

  const handleServiceUsageReady = useCallback(() => {
    setChartVisibility((prev) => (prev.grossMargin ? prev : { ...prev, grossMargin: true }));
  }, []);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  // Don't render content if not authorized
  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 w-full max-w-7xl mx-auto px-0 sm:px-4 lg:px-6 py-4 sm:py-8">
        <h1 className="text-2xl md:text-4xl font-bold text-center mb-6 md:mb-8">Dashboard</h1>
        <p className="text-center text-gray-600 text-sm md:text-base mb-6 md:mb-8">
          Project main indicators and KPIs
        </p>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto mb-8">
          <KPICard
            title="Users"
            value={kpis?.users ?? 0}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                />
              </svg>
            }
            href="/users"
            description="Total registered authors"
            isLoading={isLoadingKpis}
          />

          <KPICard
            title="Stories"
            value={kpis?.stories ?? 0}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            }
            href="/stories"
            description="Total created stories"
            isLoading={isLoadingKpis}
          />

          <KPICard
            title="Tickets"
            value={kpis?.openTickets ?? 0}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                />
              </svg>
            }
            href="/tickets"
            description="Open and in-progress tickets"
            isLoading={isLoadingKpis}
          />
        </div>

        {kpiError ? (
          <div className="mb-8 text-center text-sm text-error" role="alert">
            <p>{kpiError}</p>
            <button
              type="button"
              className="btn btn-link btn-xs text-primary"
              onClick={() => {
                void fetchKPIs();
              }}
            >
              Retry now
            </button>
          </div>
        ) : null}

        <div className="space-y-8">
          {chartVisibility.newUsers ? (
            <NewUsersChart onReady={handleNewUsersReady} />
          ) : (
            <ChartPanelSkeleton
              title="New users"
              description="Track fresh author registrations over the selected window."
            />
          )}
          {chartVisibility.serviceUsage ? (
            <ServiceUsageChart onReady={handleServiceUsageReady} />
          ) : (
            <ChartPanelSkeleton
              title="Service usage"
              description="Monitor credit-consuming activities like story creation, narration, and print orders."
            />
          )}
          {chartVisibility.grossMargin ? (
            <GrossMarginChart />
          ) : (
            <ChartPanelSkeleton
              title="Revenue vs AI costs"
              description="Compare sales against AI spend and monitor gross margin."
            />
          )}
        </div>
      </main>
    </div>
  );
}

interface ChartPanelSkeletonProps {
  title: string;
  description?: string;
}

function ChartPanelSkeleton({ title, description }: ChartPanelSkeletonProps) {
  return (
    <section
      className="w-full rounded-2xl border border-dashed border-primary/30 bg-base-100/30 p-4 sm:p-6 shadow-inner"
      aria-label={`${title} loading placeholder`}
    >
      <div className="space-y-2">
        <div className="text-base font-semibold text-base-content/70">{title}</div>
        {description ? (
          <p className="text-sm text-base-content/60">{description}</p>
        ) : null}
      </div>
      <div className="mt-6 grid gap-4 text-sm md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-dashed border-base-300/80 bg-base-100/60 p-4"
          >
            <div className="h-3 w-24 rounded bg-base-200/80 animate-pulse" />
            <div className="mt-2 h-5 w-20 rounded bg-base-200/60 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="mt-6 h-80">
        <div className="h-full rounded-2xl border border-dashed border-base-300 bg-base-200/30 p-4 shadow-inner">
          <div className="flex h-full items-end gap-2 opacity-60">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="flex-1 rounded bg-base-100/80 animate-pulse"
                style={{ height: `${25 + index * 8}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
