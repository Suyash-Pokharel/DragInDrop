import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const nodeEnv = process.env.NODE_ENV;

  return NextResponse.json({
    config: {
      hasClientId: !!clientId,
      clientIdLength: clientId?.length || 0,
      clientIdPrefix: clientId?.substring(0, 20) + "...",
      hasClientSecret: !!clientSecret,
      clientSecretLength: clientSecret?.length || 0,
      appUrl,
      nodeEnv,
      redirectUri: `${appUrl}/api/oauth/youtube/callback`,
    },
    instructions: {
      step1: "Verify the redirect URI matches exactly in Google Cloud Console",
      step2: "Ensure OAuth client type is 'Web application'",
      step3: "Verify YouTube Data API v3 is enabled",
      step4: "Check that the OAuth consent screen is configured",
    },
  });
}
