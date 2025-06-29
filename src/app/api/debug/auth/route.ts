import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Allow this endpoint temporarily for debugging production issues
  // Remove or restrict this after debugging
  
  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AUTH_URL: process.env.AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET',
    AUTH_SECRET: process.env.AUTH_SECRET ? 'SET' : 'NOT SET',
  };

  return NextResponse.json({
    message: 'Auth Debug Info',
    environmentVariables: envVars,
    url: request.url,
    headers: {
      host: request.headers.get('host'),
      'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
      'x-forwarded-host': request.headers.get('x-forwarded-host'),
    }
  });
}
