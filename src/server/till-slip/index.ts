/**
 * Till Slip Review Channel Module
 * 
 * Provides functionality for QR code-based customer feedback collection
 * from receipts/till slips.
 * 
 * @module till-slip
 */

export {
  // Token generation and verification
  generateSecureToken,
  hashToken,
  hashReceiptRef,
  mintReceiptToken,
  verifyReceiptToken,
  markTokenAsSubmitted,
  markTokenAsRedeemed,
  expireOldTokens,
  mintTokenBatch,
  
  // URL utilities
  buildFeedbackUrl,
  validateFeedbackUrl,
  extractTokenFromUrl,
  getReceiptLastFour,
  
  // Types
  type MintTokenResult,
  type VerifyTokenResult,
  type MintTokenOptions,
} from './tokens';

export {
  // Spam detection
  calculateSpamScore,
  checkRateLimit,
  cleanupRateLimits,
  hashIP,
  hashUserAgent,
  generateDeviceFingerprint,
  verifyCaptcha,
  verifyHCaptcha,
  verifyTurnstile,
  DEFAULT_SPAM_CONFIG,
  
  // Types
  type SpamCheckInput,
  type SpamCheckResult,
  type SpamConfig,
} from './spam-detection';

export {
  // Security & sanitization
  sanitizeText,
  sanitizeThemes,
  sanitizeRating,
  validateReceiptRef,
  isValidEmail,
  
  // Audit logging
  logTillSlipAudit,
  getTillSlipAuditLogs,
  
  // Tenant isolation
  verifyTenantIsolation,
  checkTenantAccess,
  
  // Types
  type TillSlipAuditEvent,
  type TillSlipAuditEntry,
} from './security';
