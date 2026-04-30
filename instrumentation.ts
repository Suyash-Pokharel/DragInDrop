/**
 * Next.js Instrumentation File
 * 
 * This file is automatically loaded by Next.js when the server starts.
 * It's used to perform one-time initialization tasks like environment validation.
 * 
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

/**
 * Register function is called once when the server starts
 * 
 * This is the perfect place to validate environment variables and perform
 * other startup checks before the application begins handling requests.
 */
export async function register() {
  // Only run on the server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import the validation function
    const { validateEnvironmentOrThrow } = await import('./src/lib/env');
    
    try {
      // Validate all required environment variables
      // This will throw an error if any required variables are missing
      validateEnvironmentOrThrow();
    } catch (error) {
      // Log the error and exit the process
      // This prevents the application from starting with invalid configuration
      console.error('[instrumentation] Failed to start application due to environment validation errors');
      
      if (error instanceof Error) {
        console.error(error.message);
      }
      
      // In production, we want to fail fast
      // In development, we also want to fail to catch configuration issues early
      process.exit(1);
    }
  }
}
