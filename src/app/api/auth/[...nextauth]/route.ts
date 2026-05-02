import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import TwitterProvider from "next-auth/providers/twitter";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getPrisma } from "@/lib/prisma";
import { perIpLoginLimiter, perEmailLoginLimiter } from "@/lib/limiter";
import bcrypt from "bcryptjs";

// Wrap getPrisma with error handling to prevent crashes
function getSafePrisma() {
  try {
    return getPrisma();
  } catch (error) {
    console.error("Failed to initialize Prisma client:", error);
    throw error;
  }
}

/**
 * NextAuth configuration options
 * This will be expanded in subsequent tasks to include:
 * - OAuth providers (Google, Facebook, TikTok, X, LinkedIn)
 * - Credentials provider for email/password
 * - Session callbacks
 * - JWT callbacks
 */
export const authOptions: NextAuthOptions = {
  // Only use adapter for OAuth providers, not for JWT session validation
  // This prevents database queries on every session check
  adapter: PrismaAdapter(getSafePrisma()),

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
        url: "https://www.tiktok.com/v2/auth/authorize/",
        params: {
          client_key: process.env.TIKTOK_CLIENT_KEY,
          scope: "user.info.basic,video.upload,video.publish",
          response_type: "code",
        },
      },
      token: "https://open.tiktokapis.com/v2/oauth/token/",
      userinfo: "https://open.tiktokapis.com/v2/user/info/",
      clientId: process.env.TIKTOK_CLIENT_KEY!,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
      profile(profile: {
        data: {
          user: { open_id: string; email: string; display_name: string; avatar_url: string };
        };
      }) {
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
      profile(profile: {
        id: string;
        localizedFirstName?: string;
        localizedLastName?: string;
        email?: string;
        profilePicture?: { displayImage?: string };
      }) {
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
        const prisma = getSafePrisma();
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
    async signIn({ user, account, profile }) {
      // For OAuth providers, handle account creation/linking properly
      if (account?.provider !== "credentials") {
        try {
          const prisma = getSafePrisma();

          // Get the email from the OAuth profile
          const email = (profile?.email || user.email)?.toLowerCase().trim();

          if (!email) {
            console.error("No email provided by OAuth provider");
            return false;
          }

          // Check if a user with this email already exists
          const existingUser = await prisma.user.findUnique({
            where: { email },
            include: { Account: true },
          });

          // If user exists, check if they have an account with this provider
          if (existingUser && account) {
            const hasThisProvider = existingUser.Account.some(
              (acc) =>
                acc.provider === account.provider &&
                acc.providerAccountId === account.providerAccountId,
            );

            // If they don't have this specific provider account linked, block sign-in
            // This prevents automatic account linking and forces explicit user action
            if (!hasThisProvider) {
              console.error(
                `User ${email} exists but doesn't have ${account.provider} account linked`,
              );
              return false; // This will trigger OAuthAccountNotLinked error
            }

            // User exists and has this provider - update emailVerified if needed
            if (!existingUser.emailVerified) {
              const now = new Date();
              const timeSinceCreation = now.getTime() - existingUser.createdAt.getTime();

              if (timeSinceCreation < 5000) {
                await prisma.user.update({
                  where: { id: existingUser.id },
                  data: { emailVerified: existingUser.createdAt },
                });
              } else {
                await prisma.user.update({
                  where: { id: existingUser.id },
                  data: { emailVerified: now },
                });
              }
            }
          }
          // If user doesn't exist, PrismaAdapter will create them automatically
        } catch (error) {
          console.error("Error in signIn callback:", error);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // On initial sign-in, add user data to token
      if (user) {
        token.sub = user.id;
        token.email = user.email;

        // For OAuth providers, fetch role from database since it's not in the user object
        if (account?.provider !== "credentials") {
          try {
            const prisma = getSafePrisma();
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { role: true },
            });
            token.role = dbUser?.role || "USER";
          } catch (error) {
            console.error("Error fetching user role:", error);
            token.role = "USER";
          }
        } else {
          // For credentials provider, role is already in user object
          token.role = user.role;
        }
      }

      // For OAuth sign-in, set emailVerified
      if (account?.provider !== "credentials") {
        token.emailVerified = new Date().toISOString();
      }

      // Refresh user data from database on update trigger
      if (trigger === "update" && token.sub) {
        try {
          const prisma = getSafePrisma();
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub as string },
            select: { role: true, email: true, name: true, image: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.email = dbUser.email;
            token.name = dbUser.name;
            token.picture = dbUser.image;
          }
        } catch (error) {
          console.error("Error refreshing user data:", error);
          // Continue with existing token data
        }
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

  // Let NextAuth handle cookies automatically based on the environment

  pages: {
    signIn: "/login",
    error: "/login",
    signOut: "/login",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
