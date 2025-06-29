import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");
  const isStaticFile = request.nextUrl.pathname.startsWith("/_next") || 
                       request.nextUrl.pathname.includes(".");

  // Allow access to auth pages, API routes, and static files
  if (isAuthPage || isApiRoute || isStaticFile) {
    return NextResponse.next();
  }

  // For protected pages, let the page components handle auth checks
  // This avoids database connections in middleware
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and already handled routes
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
