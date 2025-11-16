/**
 * Google Postmaster Tools API Route
 *
 * GET /api/postmaster/traffic-stats
 *
 * Fetches the latest email deliverability metrics from Google Postmaster Tools.
 * Results are cached for 6 hours to respect API rate limits.
 *
 * Query parameters:
 * - refresh: Set to 'true' to bypass cache and fetch fresh data
 *
 * Returns:
 * - 200: Traffic stats data
 * - 204: No data available (domain not verified or insufficient volume)
 * - 401: Unauthorized
 * - 403: Forbidden (invalid domain)
 * - 500: Server error
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { getPostmasterClient } from '@/lib/postmaster/client';
import { postmasterCache } from '@/lib/postmaster/cache';
import type { FormattedTrafficStats } from '@/types/postmaster';

const CACHE_KEY = 'postmaster:latest-traffic-stats';

export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check for refresh parameter
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';

    // Try to get from cache first (unless refresh is requested)
    if (!refresh) {
      const cached = postmasterCache.get(CACHE_KEY);
      if (cached) {
        console.log('[PostmasterAPI] Returning cached traffic stats');
        return NextResponse.json({
          success: true,
          data: cached,
          cached: true,
        });
      }
    }

    // Check if Postmaster API is configured
    if (!process.env.POSTMASTER_DOMAIN || !process.env.POSTMASTER_SERVICE_ACCOUNT_KEY) {
      console.warn('[PostmasterAPI] Postmaster API not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'Postmaster API not configured',
          message:
            'Please configure POSTMASTER_DOMAIN and service account credentials in environment variables.',
        },
        { status: 503 },
      );
    }

    // Fetch fresh data from Postmaster API
    console.log('[PostmasterAPI] Fetching latest traffic stats from Postmaster API');
    const client = getPostmasterClient();
    const rawStats = await client.getLatestTrafficStats();

    // Handle no data available
    if (!rawStats) {
      console.warn('[PostmasterAPI] No traffic stats available');
      return NextResponse.json(
        {
          success: false,
          error: 'No data available',
          message:
            'No traffic statistics available. This may happen if the domain is not verified in Postmaster Tools or if email volume is too low.',
        },
        { status: 204 },
      );
    }

    // Format the stats
    const formattedStats: FormattedTrafficStats = client.formatTrafficStats(rawStats);

    // Cache the result
    postmasterCache.set(CACHE_KEY, formattedStats);

    console.log('[PostmasterAPI] Successfully fetched and cached traffic stats', {
      date: formattedStats.date,
      reputation: formattedStats.domainReputation,
    });

    return NextResponse.json({
      success: true,
      data: formattedStats,
      cached: false,
    });
  } catch (error) {
    console.error('[PostmasterAPI] Error fetching traffic stats:', error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Access denied',
            message:
              'Access denied to Postmaster Tools API. Please verify domain-wide delegation is configured with the correct scope: https://www.googleapis.com/auth/postmaster.readonly',
          },
          { status: 403 },
        );
      }

      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Domain not found',
            message:
              'Domain not found in Postmaster Tools. Please verify the domain in Postmaster Tools: https://postmaster.google.com',
          },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}
