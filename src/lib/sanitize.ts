export function sanitizeString(input: string | null | undefined, maxLength = 500): string {
  if (!input) return "";
  
  let sanitized = input.trim().slice(0, maxLength);
  
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
  
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, "");
  sanitized = sanitized.replace(/<[^>]+>/g, "");
  
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
  
  return sanitized;
}

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

export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return "";
  
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

export function validateRedirectUri(redirectUri: string, expectedUri: string): boolean {
  try {
    const provided = new URL(redirectUri);
    const expected = new URL(expectedUri);
    
    return (
      provided.protocol === expected.protocol &&
      provided.host === expected.host &&
      provided.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}

export function validateHttps(url: string, isProduction: boolean): boolean {
  if (!isProduction) return true;
  
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
