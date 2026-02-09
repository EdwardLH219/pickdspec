# Security Implementation (V1)

This document describes the security measures enforced in Pick'd V1.

## Authentication

### NextAuth.js v5
- **JWT Strategy**: Stateless session tokens with 30-day expiry
- **Credentials Provider**: Email/password with bcrypt (cost factor 12)
- **OAuth Support**: Google OAuth with account linking protection
- **Session Refresh**: Automatic token refresh every 24 hours

### Protected Routes
- Middleware enforces authentication on all routes except:
  - `/`, `/login`, `/register`, `/forgot-password`
  - `/api/auth/*` (authentication endpoints)
- Admin routes (`/admin/*`, `/api/admin/*`) require `PICKD_ADMIN` role

## Authorization (RBAC)

### Role Hierarchy
| Role | Access Level |
|------|-------------|
| `PICKD_ADMIN` | Full platform access, all tenants |
| `PICKD_SUPPORT` | Read-only platform access, all tenants |
| `OWNER` | Full access to own organization/tenants |
| `MANAGER` | Limited access to assigned tenants |
| `STAFF` | Read-only access to assigned tenants |

### Admin-Only Resources
The following resources are restricted to Pick'd staff:
- `parameter_sets` - Scoring algorithm parameters
- `score_runs` - Scoring job management
- `audit_logs` - System audit logs
- `all_tenants` - Cross-tenant access

### Server-Side Enforcement
All API routes verify:
1. Authentication via `auth()` session check
2. Role-based permissions via `authorizePickdAdmin()` or `hasPermission()`
3. Tenant access via `hasTenantAccess()` for tenant-scoped data

```typescript
// Example: Admin API protection
const session = await auth();
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
authorizePickdAdmin(session.user); // Throws if not admin
```

## Tenant Isolation

### Database Query Enforcement
- All tenant-scoped queries use `tenantWhere()` helper
- `createTenantScopedClient()` provides pre-filtered Prisma operations
- Cross-tenant access is blocked at query level, not just UI

```typescript
// Example: Tenant-scoped query
import { tenantWhere } from '@/server/db/tenant-scope';

const reviews = await db.review.findMany({
  where: {
    ...tenantWhere(session.user, requestedTenantId),
    // Additional filters...
  },
});
```

### Multi-Tenant Security
- Users have explicit `tenantAccess[]` array in their profile
- Pick'd staff (`isPickdStaff: true`) bypass tenant restrictions
- Tenant ID validated on every data mutation

## Rate Limiting

### Protected Endpoints
| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/register` | 5 requests | 1 minute |
| Login attempts | 10 requests | 15 minutes |
| CSV exports | 10 exports | 1 hour |
| Score run triggers | 20 triggers | 1 hour |
| Password reset | 3 requests | 1 hour |
| General API | 100 requests | 1 minute |

### Implementation
- In-memory rate limiting (upgrade to Redis for multi-instance)
- Per-IP limiting for unauthenticated endpoints
- Per-user limiting for authenticated endpoints
- Standard `429 Too Many Requests` response with `Retry-After` header

```typescript
// Example: Rate limiting
const rateLimitResult = rateLimit(request, 'login', RateLimiters.login);
if (rateLimitResult) return rateLimitResult; // Returns 429 if exceeded
```

## Input Validation

### Request Validation
- Zod schemas for all API request bodies
- Type-safe parameter parsing
- Explicit validation error messages

### Output Sanitization (XSS Prevention)
- All user-generated content (reviews, names) sanitized before output
- HTML entities escaped: `& < > " ' / \` =`
- Script/style/iframe tags stripped from content
- URLs validated (only `http:` and `https:` allowed)

```typescript
// Example: Output sanitization
import { sanitizeReviewContent, sanitizeAuthorName } from '@/server/security/sanitize';

const review = {
  content: sanitizeReviewContent(rawContent),
  authorName: sanitizeAuthorName(rawName),
};
```

## Audit Logging

### Tracked Actions
All admin actions are logged to `AuditLog` table:
- Parameter version create/publish
- Rule set version create/publish
- Score run triggers
- Connector create/update/delete
- Data exports (CSV)
- Login/logout events

### Audit Record Contents
- Actor (user ID, email, role)
- Action type and resource
- Before/after values for changes
- Request context (IP, user agent, request ID)
- Timestamp

## Sensitive Data Protection

### Password Storage
- Passwords hashed with bcrypt (cost factor 12)
- Plain passwords never stored or logged

### Connector Credentials
- OAuth tokens and API keys encrypted at rest
- AES-256-GCM encryption for `externalConfig`
- Credentials masked in API responses

### Audit Log Sanitization
- Sensitive fields (`password`, `token`, `apiKey`, etc.) redacted
- Full values never stored in audit logs

## Security Headers

### API Responses
- `Cache-Control: no-store` for sensitive endpoints
- Rate limit headers (`X-RateLimit-*`) included

### Health Endpoints
- `/api/health/live` - Liveness probe (no auth required)
- `/api/health/ready` - Readiness probe (checks DB)
- `/api/health` - Full health check with component status

## Error Handling

### Secure Error Messages
- Generic error messages in production
- Detailed errors only in development (`NODE_ENV=development`)
- Authorization errors don't leak resource existence

### Error Reporting
- Structured logging with Pino
- Error reporter hooks for external services (Sentry, etc.)
- Request ID correlation for debugging

## Recommendations for Production

### Before Going Live
1. **Enable HTTPS** - Enforce TLS for all connections
2. **Set secure cookies** - Enable `__Secure-` cookie prefix
3. **Configure CSP** - Add Content-Security-Policy headers
4. **Redis rate limiting** - Replace in-memory store for multi-instance
5. **WAF** - Consider Cloudflare or AWS WAF for edge protection
6. **Secrets management** - Use vault/secrets manager for credentials

### Environment Variables
Required security-related env vars:
```
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=https://your-domain.com
ENCRYPTION_KEY=<32-byte-hex-key>
```

## Reporting Security Issues

If you discover a security vulnerability, please email security@pickd.co.za rather than opening a public issue.
