import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Derives a 32-byte encryption key from the APP_SECRET environment variable.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    console.warn('[Security] APP_SECRET is missing. Using fallback dev key. DO NOT USE IN PRODUCTION.');
  }
  const baseKey = (secret || 'dev_insecure_fallback_encryption_key_v1').trim();
  return crypto.scryptSync(baseKey, 'static-salt-for-messenger-inbox', 32);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns the encrypted string format: iv:authTag:encryptedData
 */
export function encryptToken(text: string): string {
  if (!text) return text;
  if (text.startsWith('dev_') || text.startsWith('test_')) return text; // Skip mock tokens

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Expects input format: iv:authTag:encryptedData
 */
export function decryptToken(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  if (encryptedText.startsWith('dev_') || encryptedText.startsWith('test_')) return encryptedText;
  
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    // If the token isn't in the expected encrypted format (e.g. legacy plaintext token),
    // return it as-is for backward compatibility during migration.
    return encryptedText;
  }
  
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedData = parts[2];
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[Security] Token decryption failed:', error);
    throw new Error('Failed to decrypt token. Key may have rotated or token is corrupted.');
  }
}
