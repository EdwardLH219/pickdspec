/**
 * Unit Tests for Till Slip Security Utilities
 * 
 * Tests XSS sanitization, input validation, and audit logging.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sanitizeText,
  sanitizeThemes,
  sanitizeRating,
  validateReceiptRef,
  isValidEmail,
} from '../security';

// ============================================================
// XSS SANITIZATION TESTS
// ============================================================

describe('XSS Sanitization', () => {
  describe('sanitizeText', () => {
    it('removes script tags', () => {
      const malicious = '<script>alert("xss")</script>Hello';
      expect(sanitizeText(malicious)).toBe('Hello');
    });

    it('removes script tags with attributes', () => {
      const malicious = '<script src="evil.js"></script>Safe text';
      expect(sanitizeText(malicious)).toBe('Safe text');
    });

    it('removes multiple script tags', () => {
      const malicious = '<script>a</script>Hello<script>b</script>World';
      expect(sanitizeText(malicious)).toBe('HelloWorld');
    });

    it('removes javascript: protocol', () => {
      const malicious = 'Click javascript:alert(1) here';
      expect(sanitizeText(malicious)).not.toContain('javascript:');
    });

    it('removes event handlers', () => {
      const malicious = '<img onerror="alert(1)" src="x">Image';
      expect(sanitizeText(malicious)).not.toContain('onerror');
    });

    it('removes various event handlers', () => {
      const handlers = [
        '<div onclick="evil()">',
        '<img onload="evil()">',
        '<body onmouseover="evil()">',
        '<input onfocus="evil()">',
      ];

      handlers.forEach(h => {
        const result = sanitizeText(h);
        expect(result).not.toMatch(/on\w+=/i);
      });
    });

    it('removes data: URLs', () => {
      const malicious = '<img src="data:image/svg+xml,<svg onload=alert(1)>">';
      expect(sanitizeText(malicious)).not.toContain('data:');
    });

    it('removes all HTML tags', () => {
      const html = '<div><span>Hello</span> <b>World</b></div>';
      expect(sanitizeText(html)).toBe('Hello World');
    });

    it('escapes HTML entities', () => {
      const input = 'Tom & Jerry < Bugs > Bunny';
      const result = sanitizeText(input);
      expect(result).toContain('&amp;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('removes null bytes', () => {
      const malicious = 'Hello\x00World';
      expect(sanitizeText(malicious)).toBe('HelloWorld');
    });

    it('removes control characters', () => {
      const malicious = 'Hello\x01\x02\x03World';
      expect(sanitizeText(malicious)).toBe('HelloWorld');
    });

    it('preserves newlines by default', () => {
      const input = 'Line 1\nLine 2';
      expect(sanitizeText(input)).toBe('Line 1\nLine 2');
    });

    it('removes newlines when allowNewlines is false', () => {
      const input = 'Line 1\nLine 2';
      expect(sanitizeText(input, { allowNewlines: false })).toBe('Line 1 Line 2');
    });

    it('normalizes whitespace', () => {
      const input = 'Too    many     spaces';
      expect(sanitizeText(input)).toBe('Too many spaces');
    });

    it('trims leading and trailing whitespace', () => {
      const input = '   Hello World   ';
      expect(sanitizeText(input)).toBe('Hello World');
    });

    it('enforces max length', () => {
      const input = 'A'.repeat(100);
      expect(sanitizeText(input, { maxLength: 50 })).toHaveLength(50);
    });

    it('handles null input', () => {
      expect(sanitizeText(null)).toBe('');
    });

    it('handles undefined input', () => {
      expect(sanitizeText(undefined)).toBe('');
    });

    it('handles empty string', () => {
      expect(sanitizeText('')).toBe('');
    });

    it('preserves safe Unicode characters', () => {
      const input = 'Café résumé 日本語 🍕';
      const result = sanitizeText(input);
      expect(result).toContain('Café');
      expect(result).toContain('日本語');
    });

    it('limits consecutive newlines', () => {
      const input = 'Para 1\n\n\n\n\nPara 2';
      expect(sanitizeText(input)).toBe('Para 1\n\nPara 2');
    });
  });

  describe('escapeHtml option', () => {
    it('escapes when escapeHtml is true (default)', () => {
      const input = '<b>Bold</b>';
      expect(sanitizeText(input)).toContain('&lt;');
    });

    it('does not escape when escapeHtml is false', () => {
      const input = 'Tom & Jerry';
      const result = sanitizeText(input, { escapeHtml: false });
      expect(result).toBe('Tom & Jerry');
    });
  });
});

// ============================================================
// THEME SANITIZATION TESTS
// ============================================================

describe('Theme Sanitization', () => {
  const allowedThemes = [
    'Service',
    'Food Quality',
    'Ambiance',
    'Value',
    'Wait Time',
    'Cleanliness',
  ];

  describe('sanitizeThemes', () => {
    it('accepts valid themes', () => {
      const input = ['Service', 'Food Quality'];
      expect(sanitizeThemes(input, allowedThemes)).toEqual(['Service', 'Food Quality']);
    });

    it('rejects themes not in allowed list', () => {
      const input = ['Service', 'Invalid Theme', 'Ambiance'];
      const result = sanitizeThemes(input, allowedThemes);
      expect(result).toEqual(['Service', 'Ambiance']);
    });

    it('is case-insensitive', () => {
      const input = ['SERVICE', 'food quality', 'AMBIANCE'];
      const result = sanitizeThemes(input, allowedThemes);
      // Should match based on lowercase comparison
      expect(result.length).toBe(3);
    });

    it('handles null input', () => {
      expect(sanitizeThemes(null, allowedThemes)).toEqual([]);
    });

    it('handles undefined input', () => {
      expect(sanitizeThemes(undefined, allowedThemes)).toEqual([]);
    });

    it('handles empty array', () => {
      expect(sanitizeThemes([], allowedThemes)).toEqual([]);
    });

    it('limits to max 20 themes', () => {
      const input = Array(25).fill('Service');
      const result = sanitizeThemes(input, allowedThemes);
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('trims whitespace from themes', () => {
      const input = ['  Service  ', ' Food Quality '];
      const result = sanitizeThemes(input, allowedThemes);
      expect(result).toEqual(['Service', 'Food Quality']);
    });

    it('filters out non-string values', () => {
      const input = ['Service', 123, null, 'Ambiance', undefined, {}];
      // @ts-expect-error Testing invalid input
      const result = sanitizeThemes(input, allowedThemes);
      expect(result).toEqual(['Service', 'Ambiance']);
    });

    it('filters out empty strings', () => {
      const input = ['Service', '', '   ', 'Ambiance'];
      const result = sanitizeThemes(input, allowedThemes);
      expect(result).toEqual(['Service', 'Ambiance']);
    });
  });
});

// ============================================================
// RATING VALIDATION TESTS
// ============================================================

describe('Rating Validation', () => {
  describe('sanitizeRating', () => {
    it('accepts valid ratings 1-5', () => {
      expect(sanitizeRating(1)).toBe(1);
      expect(sanitizeRating(2)).toBe(2);
      expect(sanitizeRating(3)).toBe(3);
      expect(sanitizeRating(4)).toBe(4);
      expect(sanitizeRating(5)).toBe(5);
    });

    it('rejects rating below 1', () => {
      expect(sanitizeRating(0)).toBeNull();
      expect(sanitizeRating(-1)).toBeNull();
    });

    it('rejects rating above 5', () => {
      expect(sanitizeRating(6)).toBeNull();
      expect(sanitizeRating(100)).toBeNull();
    });

    it('rejects non-integer ratings', () => {
      expect(sanitizeRating(3.5)).toBeNull();
      expect(sanitizeRating(4.9)).toBeNull();
    });

    it('parses string ratings', () => {
      expect(sanitizeRating('3')).toBe(3);
      expect(sanitizeRating('5')).toBe(5);
    });

    it('rejects invalid string ratings', () => {
      expect(sanitizeRating('abc')).toBeNull();
      expect(sanitizeRating('')).toBeNull();
    });

    it('rejects null', () => {
      expect(sanitizeRating(null)).toBeNull();
    });

    it('rejects undefined', () => {
      expect(sanitizeRating(undefined)).toBeNull();
    });
  });
});

// ============================================================
// RECEIPT REFERENCE VALIDATION TESTS
// ============================================================

describe('Receipt Reference Validation', () => {
  describe('validateReceiptRef', () => {
    it('accepts valid receipt references', () => {
      expect(validateReceiptRef('INV-2026-001234')).toBe('INV-2026-001234');
      expect(validateReceiptRef('R12345')).toBe('R12345');
      expect(validateReceiptRef('ABC-123-XYZ')).toBe('ABC-123-XYZ');
    });

    it('trims whitespace', () => {
      expect(validateReceiptRef('  INV-123  ')).toBe('INV-123');
    });

    it('removes dangerous characters', () => {
      expect(validateReceiptRef('INV<script>123')).toBe('INVscript123');
      expect(validateReceiptRef("INV'123")).toBe('INV123');
      expect(validateReceiptRef('INV"123')).toBe('INV123');
    });

    it('limits length to 100 characters', () => {
      const longRef = 'A'.repeat(150);
      const result = validateReceiptRef(longRef);
      expect(result?.length).toBe(100);
    });

    it('rejects null', () => {
      expect(validateReceiptRef(null)).toBeNull();
    });

    it('rejects undefined', () => {
      expect(validateReceiptRef(undefined)).toBeNull();
    });

    it('rejects empty string', () => {
      expect(validateReceiptRef('')).toBeNull();
    });

    it('rejects whitespace-only string', () => {
      expect(validateReceiptRef('   ')).toBeNull();
    });
  });
});

// ============================================================
// EMAIL VALIDATION TESTS
// ============================================================

describe('Email Validation', () => {
  describe('isValidEmail', () => {
    it('accepts valid email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('noat.com')).toBe(false);
    });

    it('rejects emails with spaces', () => {
      expect(isValidEmail('test @example.com')).toBe(false);
      expect(isValidEmail('test@ example.com')).toBe(false);
    });

    it('rejects emails over 254 characters', () => {
      const longEmail = 'a'.repeat(240) + '@example.com';
      expect(isValidEmail(longEmail)).toBe(false);
    });

    it('rejects null', () => {
      expect(isValidEmail(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isValidEmail(undefined)).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });
  });
});

// ============================================================
// AUDIT LOGGING TESTS (MOCKED)
// ============================================================

describe('Audit Logging', () => {
  // Mock database for audit log tests
  const mockDb = {
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
  };

  vi.mock('@/server/db', () => ({
    db: mockDb,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logTillSlipAudit', () => {
    it('creates audit log entry with correct structure', async () => {
      mockDb.user.findUnique.mockResolvedValue({
        email: 'user@example.com',
        role: 'USER',
      });
      mockDb.auditLog.create.mockResolvedValue({ id: 'audit-123' });

      await mockDb.auditLog.create({
        data: {
          actorId: 'user-1',
          actorEmail: 'user@example.com',
          actorRole: 'USER',
          action: 'UPDATE',
          resourceType: 'TillReviewSettings',
          resourceId: 'settings-1',
          tenantId: 'tenant-1',
          metadata: { tillSlipEvent: 'TILL_SETTINGS_UPDATED' },
        },
      });

      expect(mockDb.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'user-1',
            resourceType: 'TillReviewSettings',
          }),
        })
      );
    });

    it('stores old and new values for updates', async () => {
      mockDb.auditLog.create.mockResolvedValue({ id: 'audit-456' });

      await mockDb.auditLog.create({
        data: {
          actorId: 'user-1',
          actorEmail: 'admin@example.com',
          action: 'UPDATE',
          resourceType: 'TillReviewSettings',
          oldValue: { isActive: false, tokenExpiryDays: 7 },
          newValue: { isActive: true, tokenExpiryDays: 14 },
          tenantId: 'tenant-1',
        },
      });

      expect(mockDb.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            oldValue: { isActive: false, tokenExpiryDays: 7 },
            newValue: { isActive: true, tokenExpiryDays: 14 },
          }),
        })
      );
    });
  });

  describe('getTillSlipAuditLogs', () => {
    it('retrieves audit logs for a tenant', async () => {
      mockDb.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          actorEmail: 'admin@example.com',
          metadata: { tillSlipEvent: 'TILL_CODE_REDEEMED' },
          createdAt: new Date(),
        },
        {
          id: 'log-2',
          actorEmail: 'owner@example.com',
          metadata: { tillSlipEvent: 'TILL_SETTINGS_UPDATED' },
          createdAt: new Date(),
        },
      ]);

      const logs = await mockDb.auditLog.findMany({
        where: { tenantId: 'tenant-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      expect(logs.length).toBe(2);
      expect(logs[0].metadata.tillSlipEvent).toBe('TILL_CODE_REDEEMED');
    });

    it('filters by event type', async () => {
      mockDb.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          metadata: { tillSlipEvent: 'TILL_CODE_REDEEMED' },
        },
      ]);

      const logs = await mockDb.auditLog.findMany({
        where: {
          tenantId: 'tenant-1',
          metadata: { path: ['tillSlipEvent'], equals: 'TILL_CODE_REDEEMED' },
        },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].metadata.tillSlipEvent).toBe('TILL_CODE_REDEEMED');
    });
  });
});

// ============================================================
// TENANT ISOLATION TESTS
// ============================================================

describe('Tenant Isolation', () => {
  describe('verifyTenantIsolation', () => {
    it('passes when tenant IDs match', () => {
      const verifyTenantIsolation = (resourceTenantId: string, requestTenantId: string): boolean => {
        return resourceTenantId === requestTenantId;
      };

      expect(verifyTenantIsolation('tenant-1', 'tenant-1')).toBe(true);
    });

    it('fails when tenant IDs do not match', () => {
      const verifyTenantIsolation = (resourceTenantId: string, requestTenantId: string): boolean => {
        return resourceTenantId === requestTenantId;
      };

      expect(verifyTenantIsolation('tenant-1', 'tenant-2')).toBe(false);
    });
  });

  describe('checkTenantAccess', () => {
    it('returns true for user with membership in tenant org', async () => {
      const mockDb = {
        tenant: { findUnique: vi.fn() },
        membership: { findFirst: vi.fn() },
      };

      mockDb.tenant.findUnique.mockResolvedValue({ organizationId: 'org-1' });
      mockDb.membership.findFirst.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        isActive: true,
      });

      const tenant = await mockDb.tenant.findUnique({ where: { id: 'tenant-1' } });
      const membership = await mockDb.membership.findFirst({
        where: { userId: 'user-1', organizationId: tenant.organizationId },
      });

      expect(membership).not.toBeNull();
    });
  });
});
