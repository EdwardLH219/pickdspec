/**
 * Next.js Middleware
 * 
 * Handles route protection based on authentication and authorization.
 * 
 * Route Groups:
 * - (portal): Restaurant portal - requires OWNER, MANAGER, or STAFF role
 * - (admin): Pick'd admin console - requires PICKD_ADMIN role only
 * - (public): Public pages - no auth required
 * - /api/admin/*: Admin API routes - requires PICKD_ADMIN role
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
];

/**
 * Admin-only routes (Pick'd staff only)
 */
const ADMIN_ROUTES = [
  '/admin',
  '/api/admin',
];

/**
 * Check if a path matches any of the given patterns
 */
function matchesRoute(path: string, routes: string[]): boolean {
  return routes.some(route => {
    // Special case: root path only matches exactly
    if (route === '/') {
      return path === '/';
    }
    // For prefix routes ending with /, match any path starting with that prefix
    if (route.endsWith('/')) {
      return path.startsWith(route);
    }
    // Otherwise, exact match or path starts with route/
    return path === route || path.startsWith(route + '/');
  });
}

/**
 * Middleware function
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API auth routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // Get session from cookie (check all possible NextAuth cookie names)
  const sessionCookie = request.cookies.get('authjs.session-token') || 
                        request.cookies.get('__Secure-authjs.session-token') ||
                        request.cookies.get('next-auth.session-token') ||
                        request.cookies.get('__Secure-next-auth.session-token');
  
  const isAuthenticated = !!sessionCookie?.value;

  // Public routes - allow access
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    // Redirect authenticated users away from login/register
    if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protected routes - require authentication
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl, { status: 307 });
  }

  // For admin routes, we need to check the role
  // This requires reading from the session, which we'll do via a header
  // The actual role check happens in the API routes/pages
  if (matchesRoute(pathname, ADMIN_ROUTES)) {
    // Add a header to indicate this is an admin route
    // The page/API will verify the actual role
    const response = NextResponse.next();
    response.headers.set('x-middleware-admin-route', 'true');
    return response;
  }

  return NextResponse.next();
}

/**
 * Matcher configuration
 * 
 * Applies middleware to all routes except static files
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|_next).*)',
  ],
};
