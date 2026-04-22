import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): string {
  const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY;
  
  if (!ENCRYPTION_KEY) {
    throw new Error('OAUTH_ENCRYPTION_KEY environment variable is required');
  }

  if (ENCRYPTION_KEY.length !== 64) {
    throw new Error('OAUTH_ENCRYPTION_KEY must be 64 hexadecimal characters');
  }
  
  return ENCRYPTION_KEY;
}

export function encryptToken(token: string): string {
  try {
    const ENCRYPTION_KEY = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('[encryptToken] Token encryption failed:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown encryption error',
      tokenLength: token?.length || 0,
    });
    throw error;
  }
}

export function decryptToken(encryptedToken: string): string {
  const ENCRYPTION_KEY = getEncryptionKey();

  try {
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }

    const [ivHex, authTagHex, encryptedData] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[decryptToken] Token decryption failed:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown decryption error',
      encryptedTokenLength: encryptedToken?.length || 0,
    });

    if (error instanceof Error && error.message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('Token decryption failed: invalid authentication tag');
    }
    throw error;
  }
}
