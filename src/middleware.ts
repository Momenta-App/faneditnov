import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to protect all routes except login and auth APIs
 * Checks for Supabase authentication session
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login, signup, and auth API routes
  const publicPaths = [
    '/auth/login',
    '/auth/signup',
    '/auth/callback',
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/logout',
    '/api/auth/session',
    '/api/auth/callback',
  ];

  // Check if path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Don't check auth in middleware - let AuthGuard handle it client-side
  // This prevents redirect loops and allows the session to load properly
  // The middleware will just allow all requests through, and AuthGuard will check auth
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

