import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export interface AuthResult {
  success: boolean;
  error?: string;
  userId?: string;
  source?: 'session' | 'api-key';
}

/**
 * Authenticate request using either session (NextAuth) or API key
 * @param request - The incoming request
 * @returns Authentication result
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    // Check for API key authentication first (supports bearer and legacy headers)
    const authHeader = request.headers.get('authorization');
    let bearerKey: string | null = null;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      bearerKey = authHeader.slice(7).trim();
    }

    const legacyKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
    const apiKey = bearerKey || legacyKey;

    if (apiKey) {
      return await authenticateApiKey(apiKey);
    }

    // Fall back to session authentication
    return await authenticateSession();
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Authenticate using API key
 */
async function authenticateApiKey(apiKey: string): Promise<AuthResult> {
  const validApiKey = process.env.ADMIN_API_KEY;

  if (!validApiKey) {
    console.error('ADMIN_API_KEY not configured in environment');
    return {
      success: false,
      error: 'API key authentication not configured',
    };
  }

  if (apiKey !== validApiKey) {
    const mask = (key: string) =>
      key.length <= 6 ? '***' : `${key.slice(0, 3)}***${key.slice(-3)}`;
    console.warn('Invalid API key attempt:', mask(apiKey), 'expected:', mask(validApiKey));
    return {
      success: false,
      error: 'Invalid API key',
    };
  }

  // API key is valid - this represents system-to-system communication
  return {
    success: true,
    source: 'api-key',
    userId: 'system', // For API key auth, we use 'system' as userId
  };
}

/**
 * Authenticate using NextAuth session
 */
async function authenticateSession(): Promise<AuthResult> {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return {
        success: false,
        error: 'No valid session found',
      };
    }

    return {
      success: true,
      source: 'session',
      userId: session.user.email,
    };
  } catch (error) {
    console.error('Session authentication error:', error);
    return {
      success: false,
      error: 'Session authentication failed',
    };
  }
}

/**
 * Create standardized unauthorized response
 */
export function unauthorizedResponse(error?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Unauthorized',
      message: error || 'Authentication required',
    },
    { status: 401 },
  );
}

/**
 * Create standardized forbidden response
 */
export function forbiddenResponse(error?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Forbidden',
      message: error || 'Insufficient permissions',
    },
    { status: 403 },
  );
}

/**
 * Middleware for protecting API routes
 * Usage: Apply to specific routes that need authentication
 */
export function withAuth(
  handler: (request: NextRequest, context?: Record<string, unknown>) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context?: Record<string, unknown>) => {
    const auth = await authenticateRequest(request);

    if (!auth.success) {
      return unauthorizedResponse(auth.error);
    }

    // Add auth info to request for handler to use
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (request as any).auth = auth;

    return handler(request, context);
  };
}
