# Till Slip Security Documentation

This document outlines the security measures implemented for the Till Slip feedback channel in Pick't.

## Overview

The Till Slip feature allows restaurants to collect customer feedback via QR codes on receipts. Given that this involves public-facing endpoints and potentially sensitive customer data, comprehensive security measures are in place.

---

## 1. Token Security

### Opaque Tokens
- Tokens are cryptographically generated using HMAC-SHA256
- Token format: Base64URL encoded, 32+ characters
- Contains no decodable user or receipt information
- Structure: `HMAC(tenant_secret, receipt_id + timestamp)`

### Single-Use Enforcement
- Each token is tied to a single receipt
- Once a submission is made, the token is marked as `SUBMITTED`
- Subsequent submission attempts return `ALREADY_SUBMITTED` error
- Tokens cannot be reused even after expiration

### Token Expiration
- Configurable expiry (1-90 days, default 7 days)
- Expired tokens return `TOKEN_EXPIRED` error
- Expiry is checked server-side before any processing

**Implementation:** `src/server/till-slip/tokens.ts`

```typescript
// Token verification checks:
// 1. Token format validity
// 2. Cryptographic signature verification  
// 3. Expiration check
// 4. Submission status check
```

---

## 2. Privacy-Preserving IP Handling

### No Raw IP Storage
- Raw IP addresses are **never** stored in the database
- All IP-based operations use SHA-256 hashed values
- Hash includes a salt to prevent rainbow table attacks

### Hashing Implementation
```typescript
// src/server/till-slip/spam-detection.ts
export function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'default-salt';
  return crypto
    .createHash('sha256')
    .update(ip + salt)
    .digest('hex')
    .substring(0, 32);
}
```

### Usage
- Rate limiting: Uses hashed IP for tracking
- Spam detection: Device fingerprinting uses hashed values
- Analytics: Only aggregated, anonymized data

---

## 3. Tenant Isolation

### Multi-Tenant Architecture
All operations enforce tenant isolation at the database query level.

### Server-Side Enforcement
- Every database query includes `tenantId` filter
- Resources are validated against requesting user's tenant
- Cross-tenant access attempts return `403 Forbidden`

### Implementation
```typescript
// src/server/till-slip/security.ts
export function verifyTenantIsolation(
  resourceTenantId: string,
  requestTenantId: string,
  resourceType: string
): void {
  if (resourceTenantId !== requestTenantId) {
    throw new Error('Access denied - resource does not belong to this tenant');
  }
}
```

### Protected Resources
| Resource | Isolation Method |
|----------|------------------|
| TillReviewSettings | `tenantId` filter on all queries |
| TillReceipt | `tenantId` filter + token validation |
| TillReviewSubmission | `tenantId` filter via receipt relation |
| Redemption codes | Staff can only redeem codes for their tenant(s) |

---

## 4. Rate Limiting

### Public Submission Endpoint
The feedback submission endpoint has multi-layer rate limiting:

| Layer | Limit | Window | Purpose |
|-------|-------|--------|---------|
| IP-based | 10 requests | 5 minutes | Prevent flooding from single source |
| Token-based | 3 attempts | Per token lifetime | Prevent brute force on token |
| Tenant-based | 1000 requests | 1 hour | Protect against coordinated attacks |

### Implementation
```typescript
// Rate limit configuration
const RATE_LIMITS = {
  ip: { max: 10, windowMs: 5 * 60 * 1000 },
  token: { max: 3, windowMs: Infinity },
  tenant: { max: 1000, windowMs: 60 * 60 * 1000 },
};
```

### Response Headers
When rate limited:
- `429 Too Many Requests` status
- `Retry-After` header with wait time in seconds

### Other Protected Endpoints
| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/branches/:id/till/issue-receipt` | 100/minute per branch | 1 minute |
| `GET /api/branches/:id/till/mint-on-visit` | 200/minute per branch | 1 minute |

---

## 5. XSS Sanitization

### All Free Text Fields Sanitized
User input in feedback submissions is sanitized before storage:

| Field | Max Length | Sanitization |
|-------|------------|--------------|
| `positiveDetail` | 2000 chars | Full HTML/script stripping |
| `negativeDetail` | 2000 chars | Full HTML/script stripping |
| `anythingElse` | 2000 chars | Full HTML/script stripping |
| `contactEmail` | 254 chars | Format validation |

### Sanitization Process
1. Remove null bytes and control characters
2. Strip dangerous patterns (`<script>`, `javascript:`, `on*=`, etc.)
3. Remove all HTML tags
4. Escape HTML entities (`<`, `>`, `&`, `"`, `'`)
5. Normalize whitespace
6. Enforce maximum length

### Implementation
```typescript
// src/server/till-slip/security.ts
export function sanitizeText(
  input: string,
  options: { maxLength?: number; allowNewlines?: boolean; escapeHtml?: boolean }
): string;
```

### Theme Validation
- Themes are validated against an allowlist
- Only pre-defined theme options are accepted
- Custom themes are rejected

---

## 6. Audit Logging

### Logged Events
All security-relevant operations are logged to the `AuditLog` table:

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `TILL_SETTINGS_CREATED` | New settings created | Full settings snapshot |
| `TILL_SETTINGS_UPDATED` | Settings modified | Old/new values |
| `TILL_SETTINGS_ENABLED` | Channel enabled | Actor, timestamp |
| `TILL_SETTINGS_DISABLED` | Channel disabled | Actor, timestamp |
| `TILL_INCENTIVE_CHANGED` | Incentive type changed | Old/new incentive type |
| `TILL_TOKEN_EXPIRY_CHANGED` | Expiry period changed | Old/new expiry days |
| `TILL_CODE_REDEEMED` | Discount code redeemed | Code, actor, submission ID |
| `TILL_API_KEY_CREATED` | API key generated | Key prefix, permissions |
| `TILL_API_KEY_REVOKED` | API key revoked | Key prefix, reason |

### Audit Log Schema
```typescript
{
  id: string;
  actorId: string;           // User who performed action
  actorEmail: string;        // For quick reference
  actorRole: string;         // OWNER, ADMIN, etc.
  action: string;            // CREATE, UPDATE, DELETE, TRIGGER
  resourceType: string;      // TillReviewSettings, TillReviewSubmission
  resourceId: string;        // ID of affected resource
  tenantId: string;          // For tenant-scoped queries
  oldValue: JSON;            // Previous state (for updates)
  newValue: JSON;            // New state
  metadata: JSON;            // Additional context
  ipAddress: string;         // Hashed IP (optional)
  createdAt: DateTime;
}
```

### Querying Audit Logs
```typescript
// src/server/till-slip/security.ts
const logs = await getTillSlipAuditLogs(tenantId, {
  limit: 50,
  eventTypes: ['TILL_CODE_REDEEMED', 'TILL_SETTINGS_UPDATED'],
  startDate: new Date('2024-01-01'),
});
```

### Retention
- Audit logs are retained for compliance purposes
- No automatic deletion
- Accessible to OWNER and PICKD_ADMIN roles

---

## 7. API Key Security (POS Integration)

### Key Generation
- API keys are generated using cryptographically secure random bytes
- Keys are stored as SHA-256 hashes, never in plain text
- Only the key prefix (`pk_...`) is stored for identification

### Key Format
```
pk_live_<32 random hex characters>
```

### Authentication Flow
1. POS sends `Authorization: Bearer pk_live_xxx`
2. Server hashes the provided key
3. Hash is compared against stored `keyHash`
4. Permissions and expiry are validated

### Key Permissions
| Permission | Allows |
|------------|--------|
| `till:issue` | Issue new receipt tokens |
| `till:batch` | Batch issue tokens |
| `till:read` | Read receipt status |

### Security Features
- Keys can have expiration dates
- Keys can be revoked instantly
- Usage is tracked (`lastUsedAt`, `usageCount`)
- Tenant-scoped (keys only work for their tenant)

---

## 8. URL Signing (Option B Integration)

### Signed URLs
For deferred token minting, URLs are cryptographically signed:

```
/r/b/{branchId}?ref={receiptRef}&ts={timestamp}&sig={signature}
```

### Signature Generation
```typescript
signature = HMAC-SHA256(secret, branchId + receiptRef + timestamp)
```

### Validation
- Timestamp must be within 15 minutes
- Signature must match computed value
- Prevents URL tampering and replay attacks

---

## 9. Authentication & Authorization

### Public Endpoints
| Endpoint | Auth Required | Protection |
|----------|---------------|------------|
| `GET /api/feedback/[token]` | No | Token validation |
| `POST /api/feedback/[token]` | No | Token + rate limiting |
| `GET /api/branches/:id/till/mint-on-visit` | No | URL signature |

### Protected Endpoints (Require Session)
| Endpoint | Role Required | Tenant Isolated |
|----------|---------------|-----------------|
| `GET /api/portal/branches/:id/till-settings` | MEMBER+ | Yes |
| `PUT /api/portal/branches/:id/till-settings` | OWNER | Yes |
| `GET /api/portal/redeem` | MEMBER+ | Yes |
| `POST /api/portal/redeem` | MEMBER+ | Yes |
| `GET /api/portal/till-metrics` | MEMBER+ | Yes |

### Server-to-Server Endpoints
| Endpoint | Auth Method |
|----------|-------------|
| `POST /api/branches/:id/till/issue-receipt` | API Key or Session |

---

## 10. Security Headers

### Recommended Response Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self'
```

### CORS Configuration
- Public feedback endpoints allow any origin (QR code access)
- Portal endpoints restricted to application domain

---

## 11. Error Handling

### Information Disclosure Prevention
- Generic error messages for authentication failures
- Specific errors only for user-actionable issues
- Internal errors logged server-side, not exposed

### Error Response Format
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "errorMessage": "User-friendly message"
}
```

### Error Codes (Public Endpoints)
| Code | Meaning | User Message |
|------|---------|--------------|
| `TOKEN_NOT_FOUND` | Invalid token | "This link is invalid or has expired" |
| `TOKEN_EXPIRED` | Past expiry | "This feedback link has expired" |
| `ALREADY_SUBMITTED` | Token used | "Feedback has already been submitted" |
| `CHANNEL_DISABLED` | Feature off | "Feedback is currently unavailable" |
| `RATE_LIMITED` | Too many requests | "Please wait before trying again" |

---

## 12. Security Checklist

### Before Production
- [ ] Set unique `IP_HASH_SALT` environment variable
- [ ] Set unique `URL_SIGNING_SECRET` environment variable
- [ ] Configure CAPTCHA provider (hCaptcha/Turnstile recommended)
- [ ] Review rate limit settings for expected traffic
- [ ] Set up audit log monitoring/alerting
- [ ] Enable HTTPS only

### Ongoing
- [ ] Monitor audit logs for suspicious patterns
- [ ] Rotate API keys periodically
- [ ] Review and revoke unused API keys
- [ ] Monitor rate limit hits for abuse detection
- [ ] Keep dependencies updated

---

## 13. Incident Response

### Suspected Token Leak
1. Identify affected tokens via audit logs
2. Mark tokens as `REVOKED` status
3. Issue new tokens if needed

### Suspected API Key Compromise
1. Immediately revoke the key via admin panel
2. Issue new key
3. Review audit logs for unauthorized activity

### Rate Limit Spike
1. Check audit logs for patterns
2. Consider temporary IP ban if malicious
3. Adjust rate limits if legitimate traffic spike

---

## File References

| Module | Purpose |
|--------|---------|
| `src/server/till-slip/tokens.ts` | Token generation & verification |
| `src/server/till-slip/spam-detection.ts` | Rate limiting, IP hashing, spam scoring |
| `src/server/till-slip/security.ts` | XSS sanitization, audit logging, tenant isolation |
| `src/app/api/feedback/[token]/route.ts` | Public feedback endpoint |
| `src/app/api/portal/redeem/route.ts` | Staff redemption endpoint |
| `src/app/api/portal/branches/[branchId]/till-settings/route.ts` | Settings management |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-27 | Initial security documentation |
