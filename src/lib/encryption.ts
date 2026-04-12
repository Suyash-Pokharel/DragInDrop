import crypto from 'crypto';

/**
 * Encryption algorithm used for OAuth token encryption
 * AES-256-GCM provides authenticated encryption with associated data
 */
const ALGORITHM = 'aes-256-gcm';

/**
 * Gets the encryption key from environment variables
 * @returns The encryption key
 * @throws {Error} If the encryption key is missing or invalid
 */
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

/**
 * Encrypts a plaintext token using AES-256-GCM encryption
 * 
 * @param token - The plaintext token to encrypt
 * @returns Encrypted token string in format: iv:authTag:encryptedData (all hex-encoded)
 * @throws {Error} If encryption key is missing or invalid
 * 
 * @example
 * const encrypted = encryptToken('my-secret-token');
 * // Returns: "a1b2c3d4e5f6....:1234abcd....:5678efgh...."
 */
export function encryptToken(token: string): string {
  const ENCRYPTION_KEY = getEncryptionKey();

  // Generate a random 16-byte initialization vector
  const iv = crypto.randomBytes(16);

  // Convert the hex encryption key to a Buffer
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');

  // Create cipher with algorithm, key, and IV
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt the token
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Extract the authentication tag for integrity verification
  const authTag = cipher.getAuthTag();

  // Return in format: iv:authTag:encryptedData (all hex-encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted token string using AES-256-GCM decryption
 * 
 * @param encryptedToken - The encrypted token string in format: iv:authTag:encryptedData
 * @returns The decrypted plaintext token
 * @throws {Error} If encryption key is missing, invalid, or decryption fails
 * 
 * @example
 * const decrypted = decryptToken('a1b2c3d4e5f6....:1234abcd....:5678efgh....');
 * // Returns: "my-secret-token"
 */
export function decryptToken(encryptedToken: string): string {
  const ENCRYPTION_KEY = getEncryptionKey();

  try {
    // Split the encrypted string into components
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }

    const [ivHex, authTagHex, encryptedData] = parts;

    // Convert hex strings back to Buffers
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');

    // Create decipher with algorithm, key, and IV
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    // Set the authentication tag for integrity verification
    decipher.setAuthTag(authTag);

    // Decrypt the token
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Handle authentication tag verification failures
    if (error instanceof Error && error.message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('Token decryption failed: invalid authentication tag');
    }
    throw error;
  }
}
