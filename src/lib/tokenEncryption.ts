/**
 * AES-256-GCM token encryption for OAuth access/refresh tokens stored in the DB.
 *
 * Each call to `encrypt` produces a unique IV, prepended to the ciphertext in
 * the format:  <iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * Required env var:
 *   TOKEN_ENCRYPTION_KEY — 64-character hex string (32 bytes).
 *   Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 16;
const TAG_BYTES = 16;

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptToken(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format.");
  }
  const [ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const cipherText = Buffer.from(cipherHex, "hex");

  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) {
    throw new Error("Invalid encrypted token: bad IV or tag length.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(cipherText),
    decipher.final(),
  ]).toString("utf8");
}
