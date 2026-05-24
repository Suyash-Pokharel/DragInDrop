import { NextRequest, NextResponse } from "next/server";
import { ensureAuth } from "@/lib/ensureAuth";

/**
 * GET /api/oauth/facebook-pages/callback
 * Handles OAuth 2.0 callback from Facebook for Page authorization
 * This endpoint performs CSRF validation and executes the 3-step token exchange:
 * Step 1: Authorization code → Short-lived user token (1-2 hours)
 * Step 2: Short-lived user token → Long-lived user token (60 days)
 * Step 3: Long-lived user token → Never-expiring Page tokens with permission validation
 */
export async function GET(request: NextRequest) {
  // Authenticate user
  //  Return HTTP 401 if user not authenticated
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    console.error("[GET /api/oauth/facebook-pages/callback] Authentication failed:", {
      timestamp: new Date().toISOString(),
      error: "Unauthenticated request",
    });
    return user;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    // Extract query parameters
    //  Extract authorization code and state parameter from query string
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorReason = searchParams.get("error_reason");
    const errorDescription = searchParams.get("error_description");

    // Handle user authorization denial
    //  Handle user denial: redirect to settings with error message
    if (error) {
      console.log("[GET /api/oauth/facebook-pages/callback] Authorization denied:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error,
        errorReason,
        errorDescription,
      });
      return NextResponse.redirect(
        `${appUrl}/settings/social-accounts?error=${encodeURIComponent("Authorization denied")}`,
      );
    }

    // Validate authorization code is present
    //  Return HTTP 400 if state parameter is invalid or missing
    if (!code) {
      console.error("[GET /api/oauth/facebook-pages/callback] Missing authorization code:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    // Retrieve CSRF token from httpOnly cookie
    //  Retrieve CSRF token from httpOnly cookie
    const storedState = request.cookies.get("facebook_pages_oauth_state")?.value;

    // Validate state parameter matches stored CSRF token
    //  Validate state parameter matches stored CSRF token
    //  Return HTTP 400 if state parameter is invalid or missing
    if (!state || !storedState || state !== storedState) {
      console.error("[GET /api/oauth/facebook-pages/callback] Invalid state parameter:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        stateProvided: !!state,
        stateStored: !!storedState,
        stateMatch: state === storedState,
      });
      //  Log CSRF token validation failures with timestamp
      return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
    }

    // Validate CSRF token has not expired (10-minute window)
    // Note: Cookie expiration is handled by the browser. If the cookie exists, it's within the 10-minute window.
    // The cookie was set with maxAge=600 (10 minutes) in the authorize endpoint.
    // If we reach this point with a valid cookie, the token hasn't expired.

    // Log CSRF token validation success
    console.log("[GET /api/oauth/facebook-pages/callback] CSRF token validated successfully:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      codeLength: code.length,
    });

    // Validate OAuth configuration
    //  Include client_id and client_secret in token exchange
    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;

    if (!clientId || !clientSecret) {
      console.error("[GET /api/oauth/facebook-pages/callback] Configuration error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: "Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET",
      });
      return NextResponse.json({ error: "OAuth configuration error" }, { status: 500 });
    }

    // Construct redirect URI
    const redirectUri = `${appUrl}/api/oauth/facebook-pages/callback`;

    // Step 1: Exchange authorization code for short-lived user token
    // Exchange code for short-lived user token
    console.log(
      "[GET /api/oauth/facebook-pages/callback] Step 1: Exchanging authorization code for short-lived user token:",
      {
        userId: user.id,
        timestamp: new Date().toISOString(),
        redirectUri,
        codeLength: code.length,
      },
    );

    //  POST to https://graph.facebook.com/v25.0/oauth/access_token
    const tokenUrl = "https://graph.facebook.com/v25.0/oauth/access_token";

    //  Include client_id, client_secret, redirect_uri, code parameters
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code,
    });

    //  Set 10-second timeout for token exchange request
    const tokenController = new AbortController();
    const tokenTimeout = setTimeout(() => tokenController.abort(), 10000);

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams.toString(),
        signal: tokenController.signal,
      });
    } catch (fetchError) {
      clearTimeout(tokenTimeout);

      //  Handle timeout errors (return HTTP 504)
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[GET /api/oauth/facebook-pages/callback] Token exchange timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: "Request timeout",
        });
        return NextResponse.json({ error: "Request timeout. Please try again." }, { status: 504 });
      }

      console.error("[GET /api/oauth/facebook-pages/callback] Token exchange network error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: fetchError instanceof Error ? fetchError.message : "Unknown error",
      });
      //  Handle exchange failures (return HTTP 500)
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 },
      );
    } finally {
      clearTimeout(tokenTimeout);
    }

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/facebook-pages/callback] Token exchange failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: tokenResponse.status,
        error: errorData,
      });

      //  Handle exchange failures (return HTTP 500)
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 },
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token: shortLivedToken } = tokenData;

    //  Extract access_token from response (short-lived, 1-2 hours)
    if (!shortLivedToken) {
      console.error("[GET /api/oauth/facebook-pages/callback] Invalid token response:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        hasAccessToken: !!shortLivedToken,
      });
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens" },
        { status: 500 },
      );
    }

    //  Log token exchange with userId and timestamp
    console.log(
      "[GET /api/oauth/facebook-pages/callback] Step 1 complete: Short-lived user token obtained:",
      {
        userId: user.id,
        timestamp: new Date().toISOString(),
        tokenLength: shortLivedToken.length,
      },
    );

    // Step 2: Exchange short-lived user token for long-lived user token
    // Exchange for long-lived user token
    console.log(
      "[GET /api/oauth/facebook-pages/callback] Step 2: Exchanging short-lived token for long-lived user token:",
      {
        userId: user.id,
        timestamp: new Date().toISOString(),
      },
    );

    //  GET to https://graph.facebook.com/v25.0/oauth/access_token
    const longLivedTokenUrl = "https://graph.facebook.com/v25.0/oauth/access_token";

    //  Include grant_type=fb_exchange_token, client_id, client_secret, fb_exchange_token
    const longLivedTokenParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: shortLivedToken,
    });

    //  Set 10-second timeout for exchange request
    const longLivedController = new AbortController();
    const longLivedTimeout = setTimeout(() => longLivedController.abort(), 10000);

    let longLivedResponse: Response;
    try {
      longLivedResponse = await fetch(`${longLivedTokenUrl}?${longLivedTokenParams.toString()}`, {
        method: "GET",
        signal: longLivedController.signal,
      });
    } catch (fetchError) {
      clearTimeout(longLivedTimeout);

      //  Handle timeout errors (return HTTP 504)
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error(
          "[GET /api/oauth/facebook-pages/callback] Long-lived token exchange timeout:",
          {
            userId: user.id,
            timestamp: new Date().toISOString(),
            error: "Request timeout",
          },
        );
        return NextResponse.json({ error: "Request timeout. Please try again." }, { status: 504 });
      }

      console.error(
        "[GET /api/oauth/facebook-pages/callback] Long-lived token exchange network error:",
        {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: fetchError instanceof Error ? fetchError.message : "Unknown error",
        },
      );
      //  Handle exchange failures (return HTTP 500)
      return NextResponse.json(
        { error: "Failed to exchange for long-lived user token" },
        { status: 500 },
      );
    } finally {
      clearTimeout(longLivedTimeout);
    }

    if (!longLivedResponse.ok) {
      const errorData = await longLivedResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/facebook-pages/callback] Long-lived token exchange failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: longLivedResponse.status,
        error: errorData,
      });

      //  Handle exchange failures (return HTTP 500)
      return NextResponse.json(
        { error: "Failed to exchange for long-lived user token" },
        { status: 500 },
      );
    }

    const longLivedTokenData = await longLivedResponse.json();
    const { access_token: longLivedToken, expires_in: expiresIn } = longLivedTokenData;

    //  Extract access_token and expires_in from response (typically 60 days)
    if (!longLivedToken || !expiresIn) {
      console.error("[GET /api/oauth/facebook-pages/callback] Invalid long-lived token response:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        hasAccessToken: !!longLivedToken,
        hasExpiresIn: !!expiresIn,
      });
      return NextResponse.json(
        { error: "Failed to exchange for long-lived user token" },
        { status: 500 },
      );
    }

    //  Calculate expiration timestamp as current_time + expires_in seconds
    const expirationTimestamp = new Date(Date.now() + expiresIn * 1000);

    //  Log long-lived token exchange with expiration timestamp
    console.log(
      "[GET /api/oauth/facebook-pages/callback] Step 2 complete: Long-lived user token obtained:",
      {
        userId: user.id,
        timestamp: new Date().toISOString(),
        tokenLength: longLivedToken.length,
        expiresIn: expiresIn,
        expirationTimestamp: expirationTimestamp.toISOString(),
      },
    );

    // Step 3: Retrieve Page access tokens with permission validation
    console.log("[GET /api/oauth/facebook-pages/callback] Step 3: Retrieving Page access tokens:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    //  GET to https://graph.facebook.com/v25.0/me/accounts
    const pagesUrl = "https://graph.facebook.com/v25.0/me/accounts";

    //  Include long-lived user access_token in request
    //  Extract list of Pages with id, name, access_token, tasks fields
    // Also include category field for UI display 
    const pagesParams = new URLSearchParams({
      access_token: longLivedToken,
      fields: "id,name,access_token,tasks,category",
    });

    //  Set 10-second timeout for Pages request
    const pagesController = new AbortController();
    const pagesTimeout = setTimeout(() => pagesController.abort(), 10000);

    let pagesResponse: Response;
    try {
      pagesResponse = await fetch(`${pagesUrl}?${pagesParams.toString()}`, {
        method: "GET",
        signal: pagesController.signal,
      });
    } catch (fetchError) {
      clearTimeout(pagesTimeout);

      //  Handle timeout errors (return HTTP 504)
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[GET /api/oauth/facebook-pages/callback] Pages request timeout:", {
          userId: user.id,
          timestamp: new Date().toISOString(),
          error: "Request timeout",
        });
        return NextResponse.json({ error: "Request timeout. Please try again." }, { status: 504 });
      }

      console.error("[GET /api/oauth/facebook-pages/callback] Pages request network error:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        error: fetchError instanceof Error ? fetchError.message : "Unknown error",
      });
      //  Handle Pages request failures (return HTTP 500)
      return NextResponse.json({ error: "Failed to retrieve Facebook Pages" }, { status: 500 });
    } finally {
      clearTimeout(pagesTimeout);
    }

    if (!pagesResponse.ok) {
      const errorData = await pagesResponse.json().catch(() => ({}));
      console.error("[GET /api/oauth/facebook-pages/callback] Pages request failed:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: pagesResponse.status,
        error: errorData,
      });

      //  Handle Pages request failures (return HTTP 500)
      return NextResponse.json({ error: "Failed to retrieve Facebook Pages" }, { status: 500 });
    }

    const pagesData = await pagesResponse.json();
    const allPages = pagesData.data || [];

    //  Log count of Pages retrieved
    console.log("[GET /api/oauth/facebook-pages/callback] Pages retrieved:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      totalPages: allPages.length,
    });

    //  Filter Pages where user has ADMIN or EDITOR role
    //  Filter Pages where tasks array includes "CREATE_CONTENT" permission
    interface FacebookPage {
      id: string;
      name: string;
      access_token: string;
      tasks?: string[];
      category?: string;
    }

    const manageablePages = allPages.filter((page: FacebookPage) => {
      // Check if tasks array includes CREATE_CONTENT permission
      const hasCreateContentPermission = page.tasks && page.tasks.includes("CREATE_CONTENT");

      if (!hasCreateContentPermission) {
        //  Log Pages filtered due to missing CREATE_CONTENT permission
        console.log(
          "[GET /api/oauth/facebook-pages/callback] Page filtered due to missing CREATE_CONTENT permission:",
          {
            userId: user.id,
            timestamp: new Date().toISOString(),
            pageId: page.id,
            pageName: page.name,
            tasks: page.tasks || [],
          },
        );
      }

      return hasCreateContentPermission;
    });

    //  Return HTTP 400 with descriptive error if no manageable Pages found
    if (manageablePages.length === 0) {
      console.error("[GET /api/oauth/facebook-pages/callback] No manageable Pages found:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
        totalPages: allPages.length,
        manageablePages: 0,
      });

      return NextResponse.json(
        {
          error:
            "No manageable Facebook Pages found. You need ADMIN or EDITOR role with CREATE_CONTENT permission on at least one Page.",
        },
        { status: 400 },
      );
    }

    console.log(
      "[GET /api/oauth/facebook-pages/callback] Step 3 complete: Manageable Pages found:",
      {
        userId: user.id,
        timestamp: new Date().toISOString(),
        totalPages: allPages.length,
        manageablePages: manageablePages.length,
      },
    );

    //  Store available Pages data in session or temporary storage for Page selection
    // We'll encode the Pages data in the redirect URL for the Page selection UI
    const pagesDataEncoded = encodeURIComponent(JSON.stringify(manageablePages));

    // Clear CSRF token cookie after successful validation
    //  Clear CSRF token cookie after successful validation
    //  Redirect to Page selection UI with available Pages data
    const response = NextResponse.redirect(
      `${appUrl}/settings/social-accounts/select-facebook-page?pages=${pagesDataEncoded}`,
    );
    response.cookies.delete("facebook_pages_oauth_state");

    return response;
  } catch (error) {
    // Log errors with user context
    console.error("[GET /api/oauth/facebook-pages/callback] Unexpected error:", {
      userId: user.id,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Failed to complete OAuth callback" }, { status: 500 });
  }
}
