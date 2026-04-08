import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import TwitterProvider from "next-auth/providers/twitter";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getPrisma } from "@/lib/prisma";
import { perIpLoginLimiter, perEmailLoginLimiter } from "@/lib/limiter";
import bcrypt from "bcryptjs";

/**
 * NextAuth configuration options
 * This will be expanded in subsequent tasks to include:
 * - OAuth providers (Google, Facebook, TikTok, X, LinkedIn)
 * - Credentials provider for email/password
 * - Session callbacks
 * - JWT callbacks
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(getPrisma()),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
    {
      id: "tiktok",
      name: "TikTok",
      type: "oauth",
      authorization: {
        url: "https://www.tiktok.com/auth/authorize/",
        params: {
          client_key: process.env.TIKTOK_CLIENT_KEY,
          scope: "user.info.basic",
          response_type: "code",
        },
      },
      token: "https://open-api.tiktok.com/oauth/access_token/",
      userinfo: "https://open-api.tiktok.com/oauth/userinfo/",
      clientId: process.env.TIKTOK_CLIENT_KEY!,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
      profile(profile: any) {
        return {
          id: profile.data.user.open_id,
          email: profile.data.user.email,
          name: profile.data.user.display_name || profile.data.user.email?.split("@")[0] || "User",
          emailVerified: new Date(),
          image: profile.data.user.avatar_url,
        };
      },
    },
    TwitterProvider({
      clientId: process.env.X_CLIENT_ID!,
      clientSecret: process.env.X_CLIENT_SECRET!,
      version: "2.0",
    }),
    {
      id: "linkedin",
      name: "LinkedIn",
      type: "oauth",
      authorization: {
        url: "https://www.linkedin.com/oauth/v2/authorization",
        params: {
          scope: "r_liteprofile r_emailaddress",
          response_type: "code",
        },
      },
      token: "https://www.linkedin.com/oauth/v2/accessToken",
      userinfo: "https://api.linkedin.com/v2/me",
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      profile(profile: any) {
        const firstName = profile.localizedFirstName || "";
        const lastName = profile.localizedLastName || "";
        const fullName = lastName ? `${firstName} ${lastName}` : firstName;

        return {
          id: profile.id,
          email: profile.email,
          name: fullName || profile.email?.split("@")[0] || "User",
          emailVerified: new Date(),
          image: profile.profilePicture?.displayImage,
        };
      },
    },
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const normalizedEmail = credentials.email.trim().toLowerCase();

        // Extract IP address from request headers
        const forwarded = req.headers?.["x-forwarded-for"];
        const ip =
          typeof forwarded === "string"
            ? forwarded.split(",")[0].trim()
            : req.headers?.["x-real-ip"] || "unknown";

        // Apply rate limiting
        try {
          if (ip !== "unknown") {
            await perIpLoginLimiter.consume(ip);
          }
          await perEmailLoginLimiter.consume(normalizedEmail);
        } catch {
          throw new Error("Too many login attempts. Please try again later.");
        }

        // Validate user credentials
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        if (!user.emailVerified) {
          throw new Error("Please verify your email before logging in");
        }

        if (!user.password) {
          throw new Error("Please verify your email and set a password before logging in");
        }

        // Verify password against user.password hash
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        // Return user object with required fields
        // Note: NextAuth's User type uses `string | undefined`, not `string | null`,
        // so we must convert null values to undefined.
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          emailVerified: user.emailVerified,
          image: user.image ?? undefined,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  callbacks: {
    async signIn() {
      // Simply allow sign-in
      // emailVerified is set in profile callbacks during user creation
      return true;
    },

    async jwt({ token, user, account }) {
      // On initial sign-in, add user data to token
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.role = user.role;
      }

      // For OAuth sign-in, set emailVerified
      if (account?.provider !== "credentials") {
        token.emailVerified = new Date().toISOString();
      }

      return token;
    },

    async session({ session, token }) {
      // Add user data from token to session
      if (token && session.user) {
        session.user.id = token.sub as string;
        session.user.email = token.email as string;
        session.user.role = token.role as string;
        session.user.emailVerified = token.emailVerified as string;
      }
      return session;
    },
  },

  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
