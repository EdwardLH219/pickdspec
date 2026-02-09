/**
 * NextAuth.js Configuration
 * 
 * Server-side authentication configuration using NextAuth.js v5.
 */

import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { db } from '@/server/db';
import type { SessionUser } from './types';
import type { UserRole } from '@prisma/client';

/**
 * NextAuth configuration
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  
  session: {
    strategy: 'jwt', // Use JWT for credentials provider compatibility
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [
    // Email/Password authentication
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        if (!user.isActive) {
          throw new Error('Account is deactivated');
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Update last login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        // Return full user object matching our extended type
        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isPickdStaff: user.isPickdStaff,
          organizationId: user.organizationId,
          tenantAccess: user.tenantAccess,
          image: user.image,
        };
      },
    }),

    // Google OAuth (only if credentials are configured)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],

  callbacks: {
    /**
     * Control whether a user is allowed to sign in
     */
    async signIn({ user, account }) {
      if (!user.email) return false;

      // Check if user exists in database
      const dbUser = await db.user.findUnique({
        where: { email: user.email.toLowerCase() },
      });

      // For OAuth, create user if doesn't exist
      if (!dbUser && account?.provider !== 'credentials') {
        // Don't auto-create users - they must be invited first
        return '/login?error=AccountNotFound';
      }

      if (dbUser && !dbUser.isActive) {
        return '/login?error=AccountDeactivated';
      }

      return true;
    },

    /**
     * Add user data to JWT token
     */
    async jwt({ token, user, trigger }) {
      // On sign in, add user data to token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.role = user.role;
        token.isPickdStaff = user.isPickdStaff;
        token.organizationId = user.organizationId;
        token.tenantAccess = user.tenantAccess;
        token.image = user.image;
      }

      // Refresh user data from database on update
      if (trigger === 'update' && token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            isPickdStaff: true,
            organizationId: true,
            tenantAccess: true,
          },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isPickdStaff = dbUser.isPickdStaff;
          token.organizationId = dbUser.organizationId;
          token.tenantAccess = dbUser.tenantAccess;
        }
      }

      return token;
    },

    /**
     * Add custom data to session from JWT token
     */
    async session({ session, token }) {
      // Transfer token data to session
      const sessionUser: SessionUser = {
        id: token.id as string,
        email: token.email as string,
        firstName: token.firstName as string,
        lastName: token.lastName as string,
        role: token.role as UserRole,
        isPickdStaff: token.isPickdStaff as boolean,
        organizationId: token.organizationId as string | null,
        tenantAccess: token.tenantAccess as string[],
        image: token.image as string | null,
      };

      return {
        ...session,
        user: sessionUser,
      };
    },
  },

  events: {
    /**
     * Log sign-in events
     */
    async signIn({ user }) {
      console.log(`User signed in: ${user?.email || 'unknown'}`);
    },
  },

  debug: process.env.NODE_ENV === 'development',
});

/**
 * Get the current session (server-side)
 */
export async function getSession() {
  return auth();
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  
  return session;
}

/**
 * Require specific role - throws if not authorized
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireAuth();
  
  if (!session.user || !allowedRoles.includes(session.user.role)) {
    throw new Error('Forbidden');
  }
  
  return session;
}

/**
 * Require Pick'd admin role
 */
export async function requirePickdAdmin() {
  const session = await requireAuth();
  
  if (!session.user || !session.user.isPickdStaff || session.user.role !== 'PICKD_ADMIN') {
    throw new Error('Forbidden: Pick\'d Admin only');
  }
  
  return session;
}

/**
 * Get tenant access for current user
 */
export async function getTenantAccess() {
  const session = await requireAuth();
  
  if (!session.user) {
    throw new Error('Unauthorized');
  }
  
  // Pick'd staff can access all tenants
  if (session.user.isPickdStaff) {
    return { allAccess: true, tenantIds: [] as string[] };
  }
  
  return { 
    allAccess: false, 
    tenantIds: session.user.tenantAccess 
  };
}
