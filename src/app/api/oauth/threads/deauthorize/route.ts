import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/oauth/threads/deauthorize
 *
 * Handles deauthorization callback from Threads when a user removes your app.
 * This endpoint is called by Meta/Threads when a user deauthorizes your app.
 *
 * Meta sends a signed_request parameter containing the user_id.
 *
 * Requirements:
 * - Must be publicly accessible (no authentication required)
 * - Must respond with 200 OK
 * - Should mark the user's Threads account as inactive
 *
 * @see https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the signed_request parameter from the request body
    const body = await request.json().catch(() => ({}));
    const signedRequest = body.signed_request;

    console.log("[POST /api/oauth/threads/deauthorize] Deauthorization request received:", {
      timestamp: new Date().toISOString(),
      hasSignedRequest: !!signedRequest,
    });

    // If we have a signed_request, we could decode it to get the user_id
    // For now, we'll just log it and return success
    // In production, you might want to:
    // 1. Decode the signed_request to get the user_id
    // 2. Mark the user's Threads account as inactive in the database
    // 3. Optionally notify the user

    if (signedRequest) {
      // TODO: Decode signed_request and mark account as inactive
      // The signed_request contains the Threads user ID
      console.log("[POST /api/oauth/threads/deauthorize] Signed request received (not decoded)");
    }

    // Meta expects a 200 OK response
    return NextResponse.json(
      {
        success: true,
        message: "Deauthorization callback received",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[POST /api/oauth/threads/deauthorize] Error processing deauthorization:", {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Still return 200 OK to Meta even if we have an error
    // This prevents Meta from retrying the callback
    return NextResponse.json(
      {
        success: true,
        message: "Deauthorization callback received",
      },
      { status: 200 },
    );
  }
}

/**
 * GET /api/oauth/threads/deauthorize
 *
 * Handles GET requests (for testing purposes)
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      message: "Threads deauthorization callback endpoint",
      method: "POST",
      description: "This endpoint receives deauthorization callbacks from Meta/Threads",
    },
    { status: 200 },
  );
}
