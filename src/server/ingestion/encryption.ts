/**
 * Encryption Utilities for Connector Secrets
 * 
 * Server-side only encryption for storing sensitive connector configuration
 * like API keys, OAuth tokens, and credentials.
 * 
 * Uses AES-256-GCM for authenticated encryption.
 * 
 * IMPORTANT: This module should NEVER be imported on the client side.
 */

import crypto from 'crypto';

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get the encryption key from environment or generate a deterministic one for dev
 * 
 * In production, CONNECTOR_ENCRYPTION_KEY must be set as a 64-character hex string (32 bytes)
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.CONNECTOR_ENCRYPTION_KEY;
  
  if (envKey) {
    if (envKey.length !== 64) {
      throw new Error('CONNECTOR_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    return Buffer.from(envKey, 'hex');
  }
  
  // Development fallback - derive key from AUTH_SECRET
  // This is acceptable for development but should NOT be used in production
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    throw new Error('Either CONNECTOR_ENCRYPTION_KEY or AUTH_SECRET must be set');
  }
  
  // Derive a key using PBKDF2
  const salt = 'pickd-connector-config-encryption-salt'; // Static salt for deterministic key
  return crypto.pbkdf2Sync(authSecret, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt sensitive data
 * 
 * @param plaintext - The data to encrypt (will be JSON stringified if object)
 * @returns Encrypted data as base64 string (format: iv:authTag:ciphertext)
 */
export function encrypt(plaintext: string | object): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const data = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 * 
 * @param ciphertext - The encrypted data (format: iv:authTag:ciphertext)
 * @returns Decrypted data as string
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivBase64, authTagBase64, encryptedData] = parts;
  
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  
  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }
  
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Decrypt and parse JSON data
 * 
 * @param ciphertext - The encrypted data
 * @returns Parsed JSON object
 */
export function decryptJSON<T = unknown>(ciphertext: string): T {
  const decrypted = decrypt(ciphertext);
  return JSON.parse(decrypted) as T;
}

/**
 * Check if a string looks like encrypted data
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  
  // Check if all parts look like base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return parts.every(part => base64Regex.test(part));
}

/**
 * Mask sensitive values for logging/display
 * Shows first 4 and last 4 characters
 */
export function maskSecret(value: string): string {
  if (!value || value.length < 12) {
    return '********';
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * Generate a secure random API key
 */
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a value (one-way, for comparison)
 */
export function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
