import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { isVpcDirectEgress } from '@/lib/database-config';
import { auth } from '@/auth';
import { isAllowedEmailDomain } from '@/config/auth';

interface DatabaseStatus {
  status: 'connected' | 'disconnected';
  error?: string;
}

async function isDebugEnabled(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const debugRequested = searchParams.get('debug') === 'true' || searchParams.get('debug') === '1';

  if (!debugRequested) return false;

  const session = await auth();
  const email = session?.user?.email;

  return Boolean(email && isAllowedEmailDomain(email));
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  databases: {
    mythoria: DatabaseStatus;
    workflows: DatabaseStatus;
    backoffice: DatabaseStatus;
  };
  network: {
    status: 'connected' | 'disconnected';
    publicDomain?: string;
    error?: string;
  };
  auth: {
    googleClientId: 'configured' | 'missing';
    googleClientSecret: 'configured' | 'missing';
    authSecret: 'configured' | 'missing';
    nextAuthUrl?: string;
  };
  timestamp: string;
}

export async function GET(request: NextRequest) {
  const debug = await isDebugEnabled(request);

  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Admin portal health check starting...');
    }

    // Test database connections
    const databaseResults = await Promise.allSettled([
      testDatabase('mythoria', db.mythoria),
      testDatabase('workflows', db.workflows),
      testDatabase('backoffice', db.backoffice),
    ]);

    const databases = {
      mythoria: getStatusFromResult(databaseResults[0], debug),
      workflows: getStatusFromResult(databaseResults[1], debug),
      backoffice: getStatusFromResult(databaseResults[2], debug),
    };

    // Test network connectivity to a public domain only in debug mode.
    // External egress is informative, but it should not gate core health.
    const networkResult = debug ? await testNetworkConnectivity() : { status: 'connected' as const };
    const authResult = validateAuthConfiguration(debug);

    // Determine overall health
    const allDatabasesHealthy = Object.values(databases).every((db) => db.status === 'connected');
    const authHealthy = authResult.authSecret === 'configured';
    const overallHealthy = allDatabasesHealthy && authHealthy;

    const basicInfo: HealthStatus = {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      databases,
      network: networkResult,
      auth: authResult,
      timestamp: new Date().toISOString(),
    };

    if (debug) {
      const connectionType = isVpcDirectEgress() ? 'VPC Direct Egress' : 'Public IP';

      return NextResponse.json({
        ...basicInfo,
        debug: {
          connectionType,
          environment: process.env.NODE_ENV,
          isVpcConnection: isVpcDirectEgress(),
        },
      });
    }

    return NextResponse.json(basicInfo);
  } catch (error) {
    console.error('Health check failed:', error);

    const authResult = validateAuthConfiguration(debug);

    const errorResponse: HealthStatus = {
      status: 'unhealthy',
      databases: {
        mythoria: { status: 'disconnected', ...(debug ? { error: 'Health check failed' } : {}) },
        workflows: { status: 'disconnected', ...(debug ? { error: 'Health check failed' } : {}) },
        backoffice: { status: 'disconnected', ...(debug ? { error: 'Health check failed' } : {}) },
      },
      network: {
        status: 'disconnected',
        ...(debug ? { error: 'Health check failed' } : {}),
      },
      auth: authResult,
      timestamp: new Date().toISOString(),
    };

    if (debug) {
      const connectionType = isVpcDirectEgress() ? 'VPC Direct Egress' : 'Public IP';

      return NextResponse.json(
        {
          ...errorResponse,
          debug: {
            connectionType,
            error: error instanceof Error ? error.message : 'Unknown error',
            environment: process.env.NODE_ENV,
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

async function testDatabase(
  name: string,
  dbInstance: ReturnType<typeof drizzle> | null,
): Promise<{ name: string; result: { rows?: unknown[] } }> {
  if (!dbInstance) {
    throw new Error(`${name} database not initialized`);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Testing ${name} database connection...`);
  }
  const result = await dbInstance.execute(sql`SELECT 1 as test, NOW() as timestamp`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${name} database connection test successful`);
  }
  return { name, result };
}

function validateAuthConfiguration(debug = false): HealthStatus['auth'] {
  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  return {
    googleClientId: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'missing',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'configured' : 'missing',
    authSecret: authSecret ? 'configured' : 'missing',
    ...(debug ? { nextAuthUrl: process.env.NEXTAUTH_URL || 'not set' } : {}),
  };
}

function getStatusFromResult(
  result: PromiseSettledResult<{ name: string; result: { rows?: unknown[] } }>,
  debug = false,
): DatabaseStatus {
  if (result.status === 'fulfilled') {
    return { status: 'connected' };
  }

  return {
    status: 'disconnected',
    ...(debug
      ? { error: result.reason instanceof Error ? result.reason.message : 'Unknown error' }
      : {}),
  };
}

async function testNetworkConnectivity(): Promise<{
  status: 'connected' | 'disconnected';
  publicDomain?: string;
  error?: string;
}> {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Testing network connectivity...');
    }

    const testDomain = 'https://www.google.com';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(testDomain, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Network connectivity test successful');
      }
      return {
        status: 'connected',
        publicDomain: testDomain,
      };
    } else {
      return {
        status: 'disconnected',
        publicDomain: testDomain,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    console.error('Network connectivity test failed:', error);
    return {
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown network error',
    };
  }
}
