import { NextResponse } from "next/server";
import type { ApiError } from "@/types/user";

/**
 * Error response utility for User API
 * Provides consistent error logging and response formatting
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

interface ErrorContext {
  endpoint: string;
  userId?: string;
  operation?: string;
  details?: unknown;
}

/**
 * Create a standardized error response with logging
 * 
 * @param message - User-facing error message
 * @param status - HTTP status code
 * @param context - Additional context for logging
 * @returns NextResponse with error payload
 */
export function errorResponse(
  message: string,
  status: number,
  context: ErrorContext
): NextResponse<ApiError> {
  // Log error with full context
  const logMessage = `[User API Error] ${context.endpoint} - ${message}`;
  const logContext = {
    status,
    userId: context.userId,
    operation: context.operation,
    details: context.details,
    timestamp: new Date().toISOString(),
  };

  console.error(logMessage, logContext);

  // Return consistent error format
  return NextResponse.json(
    { error: message },
    { status }
  );
}

/**
 * Handle database errors with appropriate status codes and messages
 * 
 * @param error - Database error object
 * @param context - Error context for logging
 * @returns NextResponse with appropriate error
 */
export function handleDatabaseError(
  error: any,
  context: ErrorContext
): NextResponse<ApiError> {
  // Handle Prisma-specific errors
  if (error.code === "P2002") {
    return errorResponse(
      "Email already in use",
      409,
      { ...context, details: error }
    );
  }

  if (error.code === "P2025") {
    return errorResponse(
      "User not found",
      404,
      { ...context, details: error }
    );
  }

  // Handle connection errors
  if (error instanceof Error && error.message.includes("connect")) {
    return errorResponse(
      "Database connection failed",
      500,
      { ...context, details: error.message }
    );
  }

  // Generic error (not a specific database error)
  return errorResponse(
    "Internal server error",
    500,
    { ...context, details: error }
  );
}

/**
 * Handle validation errors
 * 
 * @param message - Validation error message
 * @param context - Error context for logging
 * @returns NextResponse with 400 status
 */
export function validationError(
  message: string,
  context: ErrorContext
): NextResponse<ApiError> {
  return errorResponse(message, 400, context);
}

/**
 * Handle authentication errors
 * 
 * @param context - Error context for logging
 * @returns NextResponse with 401 status
 */
export function unauthorizedError(
  context: ErrorContext
): NextResponse<ApiError> {
  return errorResponse("Unauthorized", 401, context);
}

/**
 * Handle generic internal server errors
 * 
 * @param error - Error object
 * @param context - Error context for logging
 * @returns NextResponse with 500 status
 */
export function internalServerError(
  error: unknown,
  context: ErrorContext
): NextResponse<ApiError> {
  return errorResponse(
    "Internal server error",
    500,
    { ...context, details: error }
  );
}

/**
 * Handle query timeout errors
 * 
 * @param context - Error context for logging
 * @returns NextResponse with 504 status
 */
export function timeoutError(
  context: ErrorContext
): NextResponse<ApiError> {
  return errorResponse(
    "Request timeout",
    504,
    context
  );
}
