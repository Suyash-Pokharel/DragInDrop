/**
 * User API Response Types
 * 
 * These types define the structure of user data exchanged between
 * the client and the /api/user/me endpoint.
 */

/**
 * Response type for GET /api/user/me
 * Contains the current user's profile information
 */
export interface UserResponse {
  userId: string
  firstName: string
  lastName: string
  email: string
  profilePic: string | null
}

/**
 * Request body type for PATCH /api/user/me
 * All fields are optional to support partial updates
 */
export interface UpdateUserRequest {
  firstName?: string
  lastName?: string
  email?: string
  profilePic?: string | null
}

/**
 * Response type for PATCH /api/user/me
 * Extends UserResponse with the updatedAt timestamp for optimistic locking
 */
export interface UpdateUserResponse extends UserResponse {
  updatedAt: string
}

/**
 * Standard API error response structure
 * Used across all API endpoints for consistent error handling
 */
export interface ApiError {
  error: string
  details?: string | string[]
}
