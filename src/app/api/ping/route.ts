import { NextRequest, NextResponse } from 'next/server';
import { apiKeyService } from '@/lib/auth/api-key-service';

/**
 * Simple ping endpoint that requires API key authentication
 * Used for testing communication between services
 */
export async function GET(request: NextRequest) {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid Authorization header',
          message: 'Expected: Bearer <api_key>',
        },
        { status: 401 },
      );
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate API key
    const keyInfo = apiKeyService.validateApiKey(apiKey);

    if (!keyInfo.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key',
          source: keyInfo.source,
          debug: {
            receivedKeyLength: apiKey.length,
            receivedKeyPreview: apiKey.substring(0, 8) + '...',
            isConfigured: apiKeyService.isConfigured(),
          },
        },
        { status: 401 },
      );
    }

    // Success response
    return NextResponse.json({
      success: true,
      message: 'Pong! Communication successful',
      timestamp: new Date().toISOString(),
      permissions: keyInfo.permissions,
      source: keyInfo.source,
    });
  } catch (error) {
    console.error('Ping endpoint error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * POST endpoint for more detailed testing
 */
export async function POST(request: NextRequest) {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid Authorization header',
        },
        { status: 401 },
      );
    }

    const apiKey = authHeader.substring(7);

    // Validate API key
    const keyInfo = apiKeyService.validateApiKey(apiKey);

    if (!keyInfo.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key',
          source: keyInfo.source,
        },
        { status: 401 },
      );
    }

    // Parse request body for additional testing
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      success: true,
      message: 'Pong! POST communication successful',
      timestamp: new Date().toISOString(),
      permissions: keyInfo.permissions,
      receivedData: body,
      source: keyInfo.source,
    });
  } catch (error) {
    console.error('Ping POST endpoint error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
