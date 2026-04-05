import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserFromToken } from "@/lib/getCurrentUser";
import { cookies } from "next/headers";
import type { UserResponse, UpdateUserRequest, UpdateUserResponse, ApiError } from "@/types/user";
import {
  errorResponse,
  handleDatabaseError,
  validationError,
  unauthorizedError,
  internalServerError,
  timeoutError,
} from "./errorHandler";

/**
 * Execute a database query with a timeout
 * @param queryFn - The Prisma query function to execute
 * @param timeoutMs - Timeout in milliseconds (default: 5000ms)
 * @returns The query result or throws a timeout error
 */
async function withTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  return Promise.race([
    queryFn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Query timeout")), timeoutMs)
    ),
  ]);
}

/**
 * GET /api/user/me
 * Fetch current user's profile information
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 12.1, 12.2, 12.3, 12.4, 12.5
 */
export async function GET(): Promise<NextResponse<UserResponse | ApiError>> {
  try {
    // Get session token from cookies
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    // Verify session and get user with timeout
    const user = await withTimeout(
      () => getCurrentUserFromToken(sessionToken),
      5000
    );

    if (!user) {
      return unauthorizedError({
        endpoint: "GET /api/user/me",
        operation: "fetch user data",
      });
    }

    // Return user data (only required fields)
    const response: UserResponse = {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePic: user.profilePic ?? null,
    };

    return NextResponse.json(response);
  } catch (error) {
    // Handle timeout errors
    if (error instanceof Error && error.message === "Query timeout") {
      return timeoutError({
        endpoint: "GET /api/user/me",
        operation: "fetch user data",
      });
    }

    return handleDatabaseError(error, {
      endpoint: "GET /api/user/me",
      operation: "fetch user data",
    });
  }
}

/**
 * PATCH /api/user/me
 * Update current user's profile information
 * 
 * Validates: Requirements 13.1, 13.2, 12.1, 12.2, 12.3, 12.4, 12.5
 */
export async function PATCH(
  request: NextRequest
): Promise<NextResponse<UpdateUserResponse | ApiError>> {
  try {
    // Get session token from cookies
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    // Verify session and get user with timeout
    const user = await withTimeout(
      () => getCurrentUserFromToken(sessionToken),
      5000
    );

    if (!user) {
      return unauthorizedError({
        endpoint: "PATCH /api/user/me",
        operation: "update user data",
      });
    }

    // Parse request body
    const body: UpdateUserRequest = await request.json();

    // Validate email format if provided
    if (body.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return validationError("Invalid email format", {
          endpoint: "PATCH /api/user/me",
          userId: user.id,
          operation: "validate email",
          details: { email: body.email },
        });
      }
    }

    // Prepare update data
    const updateData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      profilePic?: string | null;
    } = {};

    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.profilePic !== undefined) updateData.profilePic = body.profilePic;

    // Update user in database with timeout
    const prisma = getPrisma();
    
    try {
      const updatedUser = await withTimeout(
        () => prisma.user.update({
          where: { id: user.id },
          data: updateData,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePic: true,
            updatedAt: true,
          },
        }),
        5000
      );

      const response: UpdateUserResponse = {
        userId: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        profilePic: updatedUser.profilePic ?? null,
        updatedAt: updatedUser.updatedAt.toISOString(),
      };

      return NextResponse.json(response);
    } catch (dbError: any) {
      // Handle timeout errors
      if (dbError instanceof Error && dbError.message === "Query timeout") {
        return timeoutError({
          endpoint: "PATCH /api/user/me",
          userId: user.id,
          operation: "update user record",
        });
      }

      return handleDatabaseError(dbError, {
        endpoint: "PATCH /api/user/me",
        userId: user.id,
        operation: "update user record",
        details: updateData,
      });
    }
  } catch (error) {
    // Handle timeout errors in session verification
    if (error instanceof Error && error.message === "Query timeout") {
      return timeoutError({
        endpoint: "PATCH /api/user/me",
        operation: "verify session",
      });
    }

    return internalServerError(error, {
      endpoint: "PATCH /api/user/me",
      operation: "update user data",
    });
  }
}
