# Till Slip Feedback Channel

This document describes the Till Slip feedback collection system, which enables restaurants to collect customer feedback via QR codes printed on receipts.

## Overview

The Till Slip channel allows customers to scan a QR code on their receipt and submit feedback about their dining experience. This creates a closed-loop system where:

1. POS prints QR code on receipt
2. Customer scans and submits feedback
3. Staff verifies and redeems incentive
4. Restaurant tracks ROI through redemption data

---

## POS Integration Approaches

There are three ways to integrate your POS system with Pick'd for receipt feedback collection.

### Option A: Server-Side Token Generation (Recommended)

**How it works:**
- POS calls Pick'd API at time of receipt printing
- API returns a unique token and QR URL
- POS prints QR code containing the URL

**Pros:**
- Each receipt has a unique, single-use token
- Full traceability from receipt to feedback to redemption
- Can associate receipt metadata (table number, covers, etc.)
- Tokens are cryptographically secure and not guessable

**Cons:**
- Requires real-time API call from POS
- POS needs network connectivity at print time
- Slight latency added to receipt printing

**Implementation:**

```bash
# Request
POST /api/branches/{branchId}/till/issue-receipt
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "receiptRef": "INV-2026-001234",
  "issuedAt": "2026-01-27T12:30:00Z",
  "meta": {
    "tableNumber": "T12",
    "covers": 4,
    "totalAmount": 850.00
  }
}

# Response
{
  "success": true,
  "token": "xK9mN2pQ4rS6tU8v",
  "qrUrl": "https://app.pickd.co/r/xK9mN2pQ4rS6tU8v?utm_source=receipt",
  "expiresAt": "2026-02-03T12:30:00Z",
  "receiptId": "rec_abc123"
}
```

---

### Option B: Deferred Token Minting (Fallback)

**How it works:**
- POS prints a QR code with a URL containing the receipt reference
- When customer scans, backend mints token on first visit
- Token is then associated with that receipt reference

**Pros:**
- No real-time API call needed at print time
- Works offline (QR is static per receipt)
- Simpler POS integration

**Cons:**
- URL contains receipt reference (slight privacy consideration)
- Token not created until customer actually scans
- Cannot pre-validate receipt uniqueness at print time

**Implementation:**

```bash
# POS prints QR with URL:
https://app.pickd.co/r/b/{branchId}?ref={receiptRef}&t={timestamp}

# Example:
https://app.pickd.co/r/b/tenant_abc?ref=INV-2026-001234&t=1706355000

# On first scan, backend:
# 1. Validates branch exists and channel is active
# 2. Checks receipt ref hasn't been used
# 3. Mints new token and redirects to feedback form
# 4. Subsequent scans use the minted token
```

**API Endpoint:**

```bash
# Request (called internally when customer scans)
GET /api/branches/{branchId}/till/mint-on-visit
  ?ref=INV-2026-001234
  &t=1706355000

# Response: Redirect to /r/{token}
```

---

### Option C: Static Branch QR + Manual Receipt Entry

**How it works:**
- Branch has a single static QR code (on table tent, menu, etc.)
- Customer scans and manually enters receipt number
- System looks up or creates receipt record

**Pros:**
- Simplest setup - no POS integration required
- Single QR code per branch (can be printed once)
- Works with any POS system

**Cons:**
- **Higher friction** - customer must manually enter receipt number
- Prone to typos and entry errors
- Cannot verify receipt authenticity
- No automatic receipt metadata

**Trade-off Analysis:**

| Factor | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Customer friction | Low | Low | **High** |
| POS integration | Required | Minimal | None |
| Receipt traceability | Full | Full | Limited |
| Offline capability | No | Yes | Yes |
| Security | High | Medium | Low |
| Setup complexity | Medium | Low | **Very Low** |

**When to use Option C:**
- Pilot/trial phase before full POS integration
- Simple operations with low volume
- Venues where receipt numbers are short and easy to type

---

## API Authentication

### Server-to-Server (POS Integration)

For Option A, use an API key for authentication:

```bash
Authorization: Bearer {api_key}
```

API keys can be generated in the portal at:
`/portal/branches/{branchId}/till-reviews` → Security Settings → API Keys

**Key Properties:**
- Scoped to specific branch
- Can be rotated without downtime
- Rate limited (100 requests/minute default)

### Key Generation

```bash
POST /api/portal/branches/{branchId}/api-keys
Authorization: Bearer {user_session_token}

{
  "name": "POS Integration",
  "permissions": ["till:issue"]
}

# Response
{
  "key": "pk_live_abc123...",
  "keyId": "key_xyz789",
  "createdAt": "2026-01-27T12:00:00Z"
}
```

---

## QR Code Specifications

### Recommended Settings

| Property | Value |
|----------|-------|
| Error Correction | Level M (15%) |
| Module Size | 4-6 pixels minimum |
| Quiet Zone | 4 modules (standard) |
| Format | PNG or SVG |
| Color | Black on white recommended |

### Size Guidelines

| Receipt Width | Recommended QR Size |
|---------------|---------------------|
| 58mm (thermal) | 25-30mm |
| 80mm (thermal) | 35-40mm |
| A4/Letter | 40-50mm |

### Template Snippet for Receipt

```
┌─────────────────────────────┐
│   Thank you for dining!     │
│                             │
│   Scan for 10% off your     │
│      next visit:            │
│                             │
│        ┌─────────┐          │
│        │ QR CODE │          │
│        └─────────┘          │
│                             │
│   Code expires: 03 Feb      │
└─────────────────────────────┘
```

---

## Error Handling

### API Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `CHANNEL_INACTIVE` | Till slip channel not enabled | Enable in portal settings |
| `DUPLICATE_RECEIPT` | Receipt ref already used | Use unique receipt numbers |
| `INVALID_BRANCH` | Branch ID not found | Verify branch ID |
| `RATE_LIMITED` | Too many requests | Implement backoff |
| `INVALID_API_KEY` | API key invalid or expired | Regenerate key |

### Handling Failures

```javascript
// Recommended: Fail gracefully
try {
  const result = await issueReceipt(branchId, receiptRef);
  printQrCode(result.qrUrl);
} catch (error) {
  if (error.code === 'RATE_LIMITED') {
    // Print receipt without QR, log for retry
    printReceiptWithoutQr();
    queueForRetry(receiptRef);
  } else {
    // Print static fallback QR (Option C)
    printStaticBranchQr();
  }
}
```

---

## Monitoring & Analytics

Track integration health via the dashboard:

- **Issue Rate**: Receipts issued per hour
- **Scan Rate**: Percentage of issued QR codes scanned
- **Completion Rate**: Percentage of scans that result in feedback
- **Redemption Rate**: Percentage of incentives redeemed

API for metrics:

```bash
GET /api/portal/till-metrics?tenantId={branchId}&periodDays=30
```

---

## Security Considerations

1. **API Keys**: Rotate regularly, use environment variables
2. **Token Expiry**: Default 7 days, configurable per branch
3. **Rate Limiting**: 100 requests/minute per API key
4. **Receipt Refs**: Hashed in database, never exposed in logs
5. **Single Use**: Tokens invalidated after feedback submission

---

## Migration Path

**Phase 1: Static QR (Week 1-2)**
- Deploy static branch QR (Option C)
- Test feedback collection flow
- Train staff on redemption

**Phase 2: Deferred Minting (Week 3-4)**
- Configure POS to print receipt ref in URL
- Test Option B flow
- Validate receipt uniqueness

**Phase 3: Full Integration (Week 5+)**
- Implement Option A API calls
- Add metadata capture
- Enable full traceability
