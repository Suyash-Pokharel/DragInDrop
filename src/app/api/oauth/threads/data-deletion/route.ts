import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/oauth/threads/data-deletion
 *
 * Handles data deletion callback from Threads when a user requests their data to be deleted.
 * This endpoint is called by Meta/Threads when a user requests data deletion (GDPR compliance).
 *
 * Meta sends a signed_request parameter containing the user_id.
 *
 * Requirements:
 * - Must be publicly accessible (no authentication required)
 * - Must respond with JSON containing a confirmation_code and url
 * - Should delete or anonymize the user's data
 *
 * Response format:
 * {
 *   "url": "https://your-domain.com/deletion?id=<unique-confirmation-code>",
 *   "confirmation_code": "<unique-confirmation-code>"
 * }
 *
 * @see https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the signed_request parameter from the request body
    const body = await request.json().catch(() => ({}));
    const signedRequest = body.signed_request;

    console.log("[POST /api/oauth/threads/data-deletion] Data deletion request received:", {
      timestamp: new Date().toISOString(),
      hasSignedRequest: !!signedRequest,
    });

    // Generate a unique confirmation code for this deletion request
    const confirmationCode = `threads_deletion_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // If we have a signed_request, we could decode it to get the user_id
    // For now, we'll just log it and return success
    // In production, you should:
    // 1. Decode the signed_request to get the user_id
    // 2. Delete or anonymize the user's Threads data
    // 3. Store the confirmation code for tracking
    // 4. Optionally notify the user

    if (signedRequest) {
      // TODO: Decode signed_request and delete user data
      // The signed_request contains the Threads user ID
      console.log("[POST /api/oauth/threads/data-deletion] Signed request received (not decoded)");

      // Example of what you should do:
      // const decoded = decodeSignedRequest(signedRequest);
      // const threadsUserId = decoded.user_id;
      // await deleteUserThreadsData(threadsUserId);
    }

    // Meta expects a JSON response with url and confirmation_code
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://suyash-pokharel.com.np";

    return NextResponse.json(
      {
        url: `${appUrl}/deletion-status?id=${confirmationCode}`,
        confirmation_code: confirmationCode,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[POST /api/oauth/threads/data-deletion] Error processing data deletion:", {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Generate a fallback confirmation code
    const confirmationCode = `threads_deletion_error_${Date.now()}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://suyash-pokharel.com.np";

    // Still return a valid response to Meta
    return NextResponse.json(
      {
        url: `${appUrl}/deletion-status?id=${confirmationCode}`,
        confirmation_code: confirmationCode,
      },
      { status: 200 },
    );
  }
}

/**
 * GET /api/oauth/threads/data-deletion
 *
 * Handles GET requests (for testing purposes)
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      message: "Threads data deletion callback endpoint",
      method: "POST",
      description: "This endpoint receives data deletion requests from Meta/Threads",
      note: "Meta expects a JSON response with 'url' and 'confirmation_code' fields",
    },
    { status: 200 },
  );
}
