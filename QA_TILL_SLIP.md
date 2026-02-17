# Till Slip Feature - Manual QA Test Script

This document provides step-by-step manual testing procedures for the Till Slip feedback channel.

---

## Prerequisites

### Test Accounts
| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| Pick't Admin | `admin@pickd.co` | `[test password]` | Admin moderation testing |
| Restaurant Owner | `owner@test-restaurant.com` | `[test password]` | Settings management |
| Restaurant Manager | `manager@test-restaurant.com` | `[test password]` | Staff functions |
| Restaurant Staff | `staff@test-restaurant.com` | `[test password]` | Code redemption |

### Test Branch
- **Branch Name:** Test Restaurant - Main
- **Branch ID:** `[test-branch-id]`
- **Organization:** Test Restaurant Group

### Tools Required
- Browser (Chrome recommended)
- Mobile device or emulator
- QR code scanner app
- Network inspector (DevTools)

---

## Test Suite 1: Token Lifecycle

### T1.1 Token Minting
**Objective:** Verify tokens are created correctly with proper expiry

**Steps:**
1. Login as Restaurant Owner
2. Navigate to Branch Settings → Till Slip
3. Enable Till Slip channel (if not enabled)
4. Set token expiry to 7 days
5. Open browser DevTools → Network tab
6. Call the API endpoint:
   ```bash
   POST /api/branches/{branchId}/till/issue-receipt
   Content-Type: application/json
   Authorization: Bearer {session-cookie}
   
   {
     "receiptRef": "TEST-001",
     "issuedAt": "2026-01-27T12:00:00Z"
   }
   ```
7. Verify response contains:
   - `token` (24+ characters, URL-safe)
   - `qrUrl` (valid URL format)
   - `expiresAt` (7 days from now)
   - `receiptId` (UUID format)

**Expected Result:**
- ✅ Token is opaque (no decodable info)
- ✅ Expiry is exactly 7 days from creation
- ✅ QR URL is valid and accessible

---

### T1.2 Token Verification
**Objective:** Verify tokens are validated correctly

**Steps:**
1. Use the token from T1.1
2. Open the QR URL in an incognito browser
3. Check the feedback form loads correctly
4. Verify in DevTools:
   - GET request returns 200
   - Response includes settings (incentive, themes, etc.)

**Expected Result:**
- ✅ Valid token shows feedback form
- ✅ Settings are correct for branch
- ✅ No authentication required

---

### T1.3 Token Expiry
**Objective:** Verify expired tokens are rejected

**Steps:**
1. Create a token with 1-day expiry (via API or wait for existing token)
2. Alternatively, manually update database to set `expiresAt` to past date
3. Access the token URL
4. Verify error page is shown

**Expected Result:**
- ✅ Error page displays "This link has expired"
- ✅ HTTP status 400 with error code `TOKEN_EXPIRED`
- ✅ No feedback form is shown

---

### T1.4 One-Time Use Enforcement
**Objective:** Verify tokens can only be used once

**Steps:**
1. Generate a new token (T1.1)
2. Complete a feedback submission (see T2.1)
3. Copy the same token URL
4. Open in new incognito window
5. Attempt to submit again

**Expected Result:**
- ✅ Second visit shows "Already submitted" error
- ✅ HTTP status 400 with error code `ALREADY_SUBMITTED`
- ✅ Database shows receipt status = `SUBMITTED`

---

## Test Suite 2: Feedback Submission

### T2.1 Successful Submission
**Objective:** Verify complete submission flow

**Steps:**
1. Generate and access a valid token URL
2. Select a star rating (e.g., 4 stars)
3. Select positive themes: "Service", "Food Quality"
4. Enter positive detail: "Staff were excellent!"
5. Select negative themes: "Wait Time"
6. Enter negative detail: "Bit slow to be seated"
7. Enter additional comments: "Will return soon"
8. Check consent checkbox
9. Click Submit

**Expected Result:**
- ✅ Loading indicator shown during submission
- ✅ Success page displayed with incentive code
- ✅ Database has new `TillReviewSubmission` record
- ✅ Database has new `Review` record with `source = 'till_slip'`
- ✅ Review themes are associated correctly

---

### T2.2 Submission Creates Review Record
**Objective:** Verify Review table is populated correctly

**Steps:**
1. Complete T2.1
2. Query database for the Review record:
   ```sql
   SELECT * FROM "Review" 
   WHERE "tillReviewSubmissionId" = '{submission-id}';
   ```
3. Verify fields:
   - `source` = 'till_slip'
   - `connectorId` = NULL
   - `rating` matches submitted rating
   - `content` contains theme references
   - `sentiment` is correctly calculated

**Expected Result:**
- ✅ Review record exists
- ✅ Source is `till_slip`
- ✅ ConnectorId is NULL (distinguishes from scraped reviews)
- ✅ Content is properly formatted

---

### T2.3 XSS Prevention in Free Text
**Objective:** Verify malicious input is sanitized

**Steps:**
1. Generate a new token
2. In the positive detail field, enter:
   ```
   <script>alert('XSS')</script>Great food!
   ```
3. In the negative detail field, enter:
   ```
   <img onerror="alert(1)" src="x">Slow service
   ```
4. Submit the form
5. Query the database for the stored values

**Expected Result:**
- ✅ No script tags in database
- ✅ No event handlers stored
- ✅ HTML entities are escaped
- ✅ Only safe text is stored

---

### T2.4 Rate Limiting
**Objective:** Verify rate limiting protects public endpoint

**Steps:**
1. Generate a token but don't use it yet
2. Write a script to send 15 rapid requests:
   ```bash
   for i in {1..15}; do
     curl -X POST "https://{domain}/api/feedback/{token}" \
       -H "Content-Type: application/json" \
       -d '{"overallRating": 5, "consentGiven": true}' &
   done
   ```
3. Check responses

**Expected Result:**
- ✅ First ~10 requests succeed or fail normally
- ✅ Later requests receive 429 Too Many Requests
- ✅ `Retry-After` header is present
- ✅ Rate limit resets after window (5 minutes)

---

## Test Suite 3: Dashboard Integration

### T3.1 Source in Dashboard Charts
**Objective:** Verify Till Slip reviews appear in source breakdown

**Steps:**
1. Complete several Till Slip submissions (T2.1)
2. Login as Restaurant Owner
3. Navigate to Dashboard
4. Find the "Reviews by Source" chart
5. Verify Till Slip is shown

**Expected Result:**
- ✅ "Till Slip" appears as a source
- ✅ Count matches number of submissions
- ✅ Percentage calculation is correct
- ✅ Color coding is consistent

---

### T3.2 Reviews in Review List
**Objective:** Verify Till Slip reviews appear in review management

**Steps:**
1. Navigate to Reviews page
2. Apply source filter "Till Slip"
3. Verify submissions appear
4. Click on a Till Slip review

**Expected Result:**
- ✅ Filter shows only Till Slip reviews
- ✅ Review card shows correct rating/content
- ✅ Source badge shows "Till Slip"
- ✅ Detail view works correctly

---

### T3.3 Flagged Submissions Not Affecting Scoring
**Objective:** Verify spam-flagged reviews are excluded from scores

**Steps:**
1. Create a submission that triggers spam detection:
   - Use VPN to change IP rapidly
   - Submit multiple low ratings quickly
2. Verify submission is flagged (`spamFlagged = true`)
3. Navigate to Scoring page
4. Check if flagged review is included

**Expected Result:**
- ✅ Flagged review has `isFlaggedForReview = true`
- ✅ Score calculation excludes flagged reviews
- ✅ Manual approval removes flag and includes in scoring

---

## Test Suite 4: Incentive Redemption

### T4.1 Redemption Code Generation
**Objective:** Verify unique redemption codes are generated

**Steps:**
1. Complete a Till Slip submission with discount incentive
2. Note the 6-character redemption code shown
3. Verify code format: uppercase alphanumeric
4. Check database for `redemptionCode` field

**Expected Result:**
- ✅ Code is 6 characters
- ✅ Code is unique across all submissions
- ✅ Code is not easily guessable
- ✅ Code stored in database

---

### T4.2 Staff Redemption Flow
**Objective:** Verify staff can redeem codes

**Steps:**
1. Login as Restaurant Staff member
2. Navigate to /redeem
3. Enter the redemption code from T4.1
4. Verify preview shows correct details
5. Click "Confirm Redemption"

**Expected Result:**
- ✅ Code lookup shows submission details
- ✅ Rating and receipt ref are displayed
- ✅ Redemption succeeds
- ✅ Code cannot be redeemed again

---

### T4.3 Cross-Tenant Redemption Prevention
**Objective:** Verify codes can't be redeemed by wrong tenant

**Steps:**
1. Generate a redemption code for Branch A
2. Login as staff member from Branch B
3. Navigate to /redeem
4. Enter the code from Branch A

**Expected Result:**
- ✅ Error: "Code not found or access denied"
- ✅ No details are revealed about the code
- ✅ Redemption is blocked

---

### T4.4 Expired Code Handling
**Objective:** Verify expired codes cannot be redeemed

**Steps:**
1. Generate a redemption code
2. Update database to set `incentiveCodeExpiry` to past date
3. Attempt to redeem the code

**Expected Result:**
- ✅ Error: "This code has expired"
- ✅ Expiry date is shown to staff
- ✅ Redemption is blocked

---

## Test Suite 5: Role-Based Access Control

### T5.1 Settings Edit - Owner Only
**Objective:** Verify only owners can edit Till Slip settings

**Steps:**
1. Login as Restaurant Manager
2. Navigate to Branch Settings → Till Slip
3. Attempt to toggle "Enable Till Slip"
4. Verify toggle is disabled or request is rejected

**Expected Result:**
- ✅ UI shows settings as read-only for non-owners
- ✅ PUT request returns 403 Forbidden
- ✅ No changes are saved

**Repeat with:**
- ✅ ADMIN role → Cannot edit
- ✅ MANAGER role → Cannot edit
- ✅ MEMBER role → Cannot edit
- ✅ OWNER role → CAN edit

---

### T5.2 Admin Moderation - Pick't Admin Only
**Objective:** Verify only Pick't admins can moderate

**Steps:**
1. Create a flagged submission (T3.3)
2. Login as Restaurant Owner
3. Navigate to submission moderation
4. Attempt to approve/reject

**Expected Result:**
- ✅ Moderation controls not visible to restaurant users
- ✅ API returns 403 for moderation requests

**Then:**
1. Login as Pick't Admin
2. Navigate to moderation queue
3. Approve or reject submission

**Expected Result:**
- ✅ Moderation controls are visible
- ✅ Approve/reject actions succeed
- ✅ Audit log is created

---

### T5.3 Staff Redemption Access
**Objective:** Verify all staff roles can redeem

**Steps:**
1. Test with each role:
   - OWNER
   - ADMIN
   - MANAGER
   - MEMBER
2. For each, navigate to /redeem
3. Verify page loads and redemption works

**Expected Result:**
- ✅ All active staff members can access /redeem
- ✅ Inactive memberships are denied
- ✅ Users with no membership are denied

---

## Test Suite 6: Audit Logging

### T6.1 Settings Change Audit
**Objective:** Verify settings changes are logged

**Steps:**
1. Login as Restaurant Owner
2. Navigate to Till Slip settings
3. Change token expiry from 7 to 14 days
4. Save changes
5. Query audit log:
   ```sql
   SELECT * FROM "AuditLog"
   WHERE "tenantId" = '{branch-id}'
   AND "metadata"->>'tillSlipEvent' = 'TILL_TOKEN_EXPIRY_CHANGED';
   ```

**Expected Result:**
- ✅ Audit entry exists
- ✅ `oldValue` shows previous expiry
- ✅ `newValue` shows new expiry
- ✅ Actor ID and email are correct

---

### T6.2 Redemption Audit
**Objective:** Verify redemptions are logged

**Steps:**
1. Complete a redemption (T4.2)
2. Query audit log:
   ```sql
   SELECT * FROM "AuditLog"
   WHERE "metadata"->>'tillSlipEvent' = 'TILL_CODE_REDEEMED';
   ```

**Expected Result:**
- ✅ Audit entry exists
- ✅ Redemption code is recorded
- ✅ Staff member ID is recorded
- ✅ Timestamp is accurate

---

## Test Suite 7: Mobile & Performance

### T7.1 Mobile Feedback Form
**Objective:** Verify feedback form works on mobile

**Steps:**
1. Generate a token and QR code
2. Scan QR code with mobile device
3. Complete feedback form on mobile
4. Verify all interactions work:
   - Star rating tap
   - Theme chip selection
   - Text input
   - Submit button

**Expected Result:**
- ✅ Form renders correctly on mobile
- ✅ All interactions are responsive
- ✅ No horizontal scrolling
- ✅ Submit works on mobile network

---

### T7.2 Low-End Device Performance
**Objective:** Verify acceptable performance on older devices

**Steps:**
1. Use Chrome DevTools → Performance tab
2. Enable CPU throttling (4x slowdown)
3. Enable network throttling (Slow 3G)
4. Load feedback form
5. Interact with form elements

**Expected Result:**
- ✅ Initial load under 3 seconds
- ✅ Star rating animation is smooth
- ✅ Theme selection is responsive
- ✅ No memory leaks during interaction

---

### T7.3 Offline/Poor Network Handling
**Objective:** Verify graceful handling of network issues

**Steps:**
1. Load feedback form
2. Fill out form completely
3. Enable "Offline" mode in DevTools
4. Click Submit
5. Verify error handling

**Expected Result:**
- ✅ User-friendly error message
- ✅ Form data is not lost
- ✅ Retry option available
- ✅ No crash or blank screen

---

## Test Suite 8: Edge Cases

### T8.1 Concurrent Submissions
**Objective:** Verify only one submission succeeds for same token

**Steps:**
1. Generate a token
2. Open token URL in two browser tabs
3. Fill out both forms
4. Click Submit on both simultaneously

**Expected Result:**
- ✅ Only one submission succeeds
- ✅ Second submission gets "Already submitted" error
- ✅ No duplicate records in database

---

### T8.2 Browser Back Button
**Objective:** Verify back button doesn't cause issues

**Steps:**
1. Complete a submission
2. View success page
3. Click browser back button
4. Attempt to submit again

**Expected Result:**
- ✅ Cannot re-submit (token is used)
- ✅ Form or error page is shown appropriately
- ✅ No duplicate submissions

---

### T8.3 Empty/Minimal Submission
**Objective:** Verify minimum required fields

**Steps:**
1. Generate a token
2. Only select a rating (no themes, no text)
3. Check consent
4. Submit

**Expected Result:**
- ✅ Submission succeeds with rating only
- ✅ Review record has default content
- ✅ No themes associated (if none selected)

---

## Regression Checklist

After any code changes, verify:

| # | Test | Status |
|---|------|--------|
| 1 | Token minting works | ☐ |
| 2 | Token verification works | ☐ |
| 3 | Token expiry is enforced | ☐ |
| 4 | One-time use is enforced | ☐ |
| 5 | Submission creates both records | ☐ |
| 6 | XSS is sanitized | ☐ |
| 7 | Source appears in dashboard | ☐ |
| 8 | Flagged submissions excluded from scoring | ☐ |
| 9 | Settings only editable by owner | ☐ |
| 10 | Moderation only by Pick't admin | ☐ |
| 11 | Staff can redeem codes | ☐ |
| 12 | Audit logs are created | ☐ |
| 13 | Mobile form works | ☐ |
| 14 | Rate limiting is active | ☐ |

---

## Test Data Cleanup

After testing, clean up test data:

```sql
-- Remove test submissions
DELETE FROM "TillReviewSubmission"
WHERE "tenantId" = '{test-branch-id}';

-- Remove test receipts
DELETE FROM "TillReceipt"
WHERE "tenantId" = '{test-branch-id}';

-- Remove test reviews
DELETE FROM "Review"
WHERE "source" = 'till_slip'
AND "tenantId" = '{test-branch-id}';

-- Remove audit logs (optional)
DELETE FROM "AuditLog"
WHERE "tenantId" = '{test-branch-id}'
AND "metadata"->>'tillSlipEvent' IS NOT NULL;
```

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-27 | System | Initial QA script |
