import crypto from "crypto";

export type SessionPayload = {
  sub: string;
  email?: string;
  iat?: number;
  exp?: number;
};

/**
 * Create a signed session token (HMAC-SHA256).
 * Used by both registration (setPassword) and login flows.
 */
export function createSignedToken(
  payload: Record<string, unknown>,
  secretKey: string,
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 7 * 24 * 60 * 60; // 7 days
  const body = { ...payload, iat, exp };

  const base64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const unsigned = `${base64(header)}.${base64(body)}`;
  const sig = crypto
    .createHmac("sha256", secretKey)
    .update(unsigned)
    .digest("base64url");

  return `${unsigned}.${sig}`;
}

/** Verify a signed session token (Node runtime). Returns payload on success or null. */
export function verifySignedToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, bodyB64, sig] = parts;
    const unsigned = `${headerB64}.${bodyB64}`;

    const secret = process.env.SESSION_SECRET;
    if (!secret) return null;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(unsigned)
      .digest("base64url");

    if (sig !== expected) return null;

    const payloadJson = Buffer.from(bodyB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as SessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}
