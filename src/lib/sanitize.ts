/**
 * Sanitizes user input from external APIs to prevent XSS and injection attacks
 * Removes potentially dangerous characters while preserving valid content
 */

/**
 * Sanitizes a string by removing or escaping potentially dangerous characters
 * @param input - The string to sanitize
 * @param maxLength - Maximum allowed length (default: 500)
 * @returns Sanitized string
 */
export function sanitizeString(input: string | null | undefined, maxLength = 500): string {
  if (!input) return "";
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
  
  // Remove potential script tags and HTML
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, "");
  sanitized = sanitized.replace(/<[^>]+>/g, "");
  
  // Escape special characters that could be used for injection
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
  
  return sanitized;
}

/**
 * Sanitizes TikTok user profile data
 * @param profile - TikTok user profile object
 * @returns Sanitized profile data
 */
export function sanitizeTikTokProfile(profile: {
  open_id?: string;
  union_id?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}) {
  return {
    open_id: sanitizeString(profile.open_id, 100),
    union_id: sanitizeString(profile.union_id, 100),
    username: sanitizeString(profile.username, 100),
    display_name: sanitizeString(profile.display_name, 100),
    avatar_url: sanitizeUrl(profile.avatar_url),
  };
}

/**
 * Sanitizes Google user profile data from YouTube OAuth
 * @param profile - Google user profile object
 * @returns Sanitized profile data
 */
export function sanitizeGoogleProfile(profile: {
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
}) {
  return {
    id: sanitizeString(profile.id, 100),
    email: sanitizeString(profile.email, 255),
    name: sanitizeString(profile.name, 100),
    picture: sanitizeUrl(profile.picture),
    verified_email: profile.verified_email,
  };
}

/**
 * Validates and sanitizes a URL
 * @param url - The URL to validate
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return "";
  
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Validates that a redirect URI matches the expected value
 * @param redirectUri - The redirect URI to validate
 * @param expectedUri - The expected redirect URI
 * @returns true if valid, false otherwise
 */
export function validateRedirectUri(redirectUri: string, expectedUri: string): boolean {
  try {
    const provided = new URL(redirectUri);
    const expected = new URL(expectedUri);
    
    // Must match protocol, host, and pathname exactly
    return (
      provided.protocol === expected.protocol &&
      provided.host === expected.host &&
      provided.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}

/**
 * Validates that HTTPS is used in production
 * @param url - The URL to validate
 * @param isProduction - Whether running in production
 * @returns true if valid, false otherwise
 */
export function validateHttps(url: string, isProduction: boolean): boolean {
  if (!isProduction) return true; // Allow HTTP in development
  
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
