/**
 * NextAuth.js Type Extensions
 * 
 * Extends the default NextAuth types to include our custom user properties.
 */

import { UserRole } from '@prisma/client';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extended User type with custom properties
   */
  interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isPickdStaff: boolean;
    organizationId: string | null;
    tenantAccess: string[];
    image?: string | null;
  }

  /**
   * Extended Session type
   */
  interface Session {
    user: User;
    expires: string;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extended JWT token type
   */
  interface JWT {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isPickdStaff: boolean;
    organizationId: string | null;
    tenantAccess: string[];
    image?: string | null;
  }
}

declare module '@auth/core/adapters' {
  /**
   * Extended AdapterUser type
   */
  interface AdapterUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isPickdStaff: boolean;
    organizationId: string | null;
    tenantAccess: string[];
    image?: string | null;
    emailVerified: Date | null;
  }
}
