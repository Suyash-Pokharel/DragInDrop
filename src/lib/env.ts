/**
 * Environment Variable Validation Module
 *
 * This module validates all required environment variables for scheduled uploads (TikTok, YouTube, Instagram, and Facebook Pages)
 * and other critical application functionality. It should be called at application startup to catch
 * configuration issues early.
 */

/**
 * Validation result for a single environment variable
 */
interface ValidationResult {
  variable: string;
  isValid: boolean;
  error?: string;
}

/**
 * Complete validation result
 */
interface EnvValidationResult {
  isValid: boolean;
  errors: ValidationResult[];
  warnings: ValidationResult[];
}

/**
 * Required environment variables for scheduled uploads (TikTok, YouTube, Instagram, and Facebook Pages)
 *
 */
const REQUIRED_ENV_VARS = [
  "CRON_SECRET", 
  "WORKER_SECRET",
  "RENDER_WORKER_URL", 
  "TIKTOK_CLIENT_KEY", 
  "TIKTOK_CLIENT_SECRET", 
  "YOUTUBE_CLIENT_ID", 
  "YOUTUBE_CLIENT_SECRET",
  "INSTAGRAM_APP_ID", 
  "INSTAGRAM_APP_SECRET",
  "FACEBOOK_APP_ID", 
  "FACEBOOK_APP_SECRET", 
  "B2_ACCOUNT_ID",
  "B2_APPLICATION_KEY", 
  "B2_BUCKET_ID", 
  "B2_BUCKET_NAME",
  "B2_ENDPOINT_URL",
  "OAUTH_ENCRYPTION_KEY", 
  "REDIS_URL",
] as const;

/**
 * Optional environment variables that should be present in production
 */
const OPTIONAL_ENV_VARS = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const;

/**
 * Validate a single environment variable
 *
 * @param {string} varName - Name of the environment variable
 * @param {boolean} required - Whether the variable is required
 * @returns {ValidationResult} Validation result
 */
function validateEnvVar(varName: string, required: boolean = true): ValidationResult {
  const value = process.env[varName];

  if (!value || value.trim() === "") {
    return {
      variable: varName,
      isValid: false,
      error: required
        ? `${varName} is required but not set`
        : `${varName} is recommended but not set`,
    };
  }

  // Additional validation for specific variables
  switch (varName) {
    case "CRON_SECRET":
      if (value.length < 32) {
        return {
          variable: varName,
          isValid: false,
          error: `${varName} should be at least 32 characters for security (current: ${value.length})`,
        };
      }
      break;

    case "WORKER_SECRET":
      //  Validate WORKER_SECRET for authenticating Upload_Worker requests
      if (value.length < 32) {
        return {
          variable: varName,
          isValid: false,
          error: `${varName} should be at least 32 characters for security (current: ${value.length})`,
        };
      }
      break;

    case "RENDER_WORKER_URL":
      //  Validate RENDER_WORKER_URL is a valid URL
      if (!value.startsWith("http://") && !value.startsWith("https://")) {
        return {
          variable: varName,
          isValid: false,
          error: `${varName} must be a valid URL starting with http:// or https:// (current: ${value.substring(0, 20)}...)`,
        };
      }
      // Validate it's a valid URL format
      try {
        new URL(value);
      } catch {
        return {
          variable: varName,
          isValid: false,
          error: `${varName} must be a valid URL`,
        };
      }
      break;

    case "OAUTH_ENCRYPTION_KEY":
      if (value.length !== 64) {
        return {
          variable: varName,
          isValid: false,
          error: `${varName} must be exactly 64 hexadecimal characters (current: ${value.length})`,
        };
      }
      // Validate it's hexadecimal
      if (!/^[0-9a-fA-F]{64}$/.test(value)) {
        return {
          variable: varName,
          isValid: false,
          error: `${varName} must contain only hexadecimal characters (0-9, a-f, A-F)`,
        };
      }
      break;

    case "REDIS_URL":
      if (!value.startsWith("redis://") && !value.startsWith("rediss://")) {
        return {
          variable: varName,
          isValid: false,
          error: `${varName} must start with redis:// or rediss:// (current: ${value.substring(0, 10)}...)`,
        };
      }
      break;

    case "B2_ENDPOINT_URL":
      // Should not include protocol
      if (value.startsWith("http://") || value.startsWith("https://")) {
        return {
          variable: varName,
          isValid: false,
          error: `${varName} should not include protocol (http:// or https://)`,
        };
      }
      break;
  }

  return {
    variable: varName,
    isValid: true,
  };
}

/**
 * Validate all required environment variables
 *
 * This function checks that all required environment variables are set and valid.
 * It returns a detailed validation result with errors and warnings.
 *
 * @returns {EnvValidationResult} Validation result with errors and warnings
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: ValidationResult[] = [];
  const warnings: ValidationResult[] = [];

  // Validate required variables
  for (const varName of REQUIRED_ENV_VARS) {
    const result = validateEnvVar(varName, true);
    if (!result.isValid) {
      errors.push(result);
    }
  }

  // Validate optional variables (warnings only)
  for (const varName of OPTIONAL_ENV_VARS) {
    const result = validateEnvVar(varName, false);
    if (!result.isValid) {
      warnings.push(result);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate environment variables and throw an error if any required variables are missing
 *
 * This function should be called at application startup to ensure all required
 * environment variables are properly configured.
 *
 * @throws {Error} If any required environment variables are missing or invalid
 *
 * @example
 * // In your application startup code:
 * validateEnvironmentOrThrow();
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();

  if (!result.isValid) {
    const errorMessages = result.errors.map((e) => `  - ${e.error}`).join("\n");
    const errorMessage = `Environment validation failed. Missing or invalid required environment variables:\n${errorMessages}\n\nPlease set these variables in your .env.local file or environment configuration.`;

    console.error("[env] Environment validation failed");
    console.error(errorMessage);

    throw new Error(errorMessage);
  }

  // Log warnings if any
  if (result.warnings.length > 0) {
    console.warn("[env] Environment validation warnings:");
    result.warnings.forEach((w) => {
      console.warn(`  - ${w.error}`);
    });
  }

  // Log success in development
  if (process.env.NODE_ENV !== "production") {
    console.log("[env] Environment validation passed");
    console.log(`[env] Validated ${REQUIRED_ENV_VARS.length} required variables`);
  }
}

/**
 * Get a required environment variable with validation
 *
 * This function retrieves an environment variable and throws an error if it's not set.
 * Use this for runtime validation when accessing environment variables.
 *
 * @param {string} varName - Name of the environment variable
 * @returns {string} The environment variable value
 * @throws {Error} If the environment variable is not set
 *
 * @example
 * const cronSecret = getRequiredEnv('CRON_SECRET');
 */
export function getRequiredEnv(varName: string): string {
  const value = process.env[varName];

  if (!value || value.trim() === "") {
    throw new Error(`Required environment variable ${varName} is not set`);
  }

  return value;
}

/**
 * Get an optional environment variable with a default value
 *
 * @param {string} varName - Name of the environment variable
 * @param {string} defaultValue - Default value if not set
 * @returns {string} The environment variable value or default
 *
 * @example
 * const redisUrl = getOptionalEnv('REDIS_URL', 'redis://127.0.0.1:6379');
 */
export function getOptionalEnv(varName: string, defaultValue: string): string {
  const value = process.env[varName];
  return value && value.trim() !== "" ? value : defaultValue;
}

/**
 * Check if running in production environment
 *
 * @returns {boolean} True if NODE_ENV is 'production'
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if running in development environment
 *
 * @returns {boolean} True if NODE_ENV is 'development'
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}
