import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import TwitterProvider from "next-auth/providers/twitter";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getPrisma } from "@/lib/prisma";
import { perIpLoginLimiter, perEmailLoginLimiter } from "@/lib/limiter";
import bcrypt from "bcryptjs";

function getSafePrisma() {
  try {
    return getPrisma();
  } catch (error) {
    console.error("Failed to initialize Prisma client:", error);
    throw error;
  }
}

export const authOptions: NextAuthOptions = {
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
      profile(profile: { data: { user: { open_id: string; email: string; display_name: string; avatar_url: string } } }) {
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
      profile(profile: { id: string; localizedFirstName?: string; localizedLastName?: string; email?: string; profilePicture?: { displayImage?: string } }) {
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

        const forwarded = req.headers?.["x-forwarded-for"];
        const ip =
          typeof forwarded === "string"
            ? forwarded.split(",")[0].trim()
            : req.headers?.["x-real-ip"] || "unknown";

        try {
          if (ip !== "unknown") {
            await perIpLoginLimiter.consume(ip);
          }
          await perEmailLoginLimiter.consume(normalizedEmail);
        } catch {
          throw new Error("Too many login attempts. Please try again later.");
        }

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

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

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
      if (account?.provider !== "credentials") {
        try {
          const prisma = getSafePrisma();
          
          const email = (profile?.email || user.email)?.toLowerCase().trim();
          
          if (!email) {
            console.error("No email provided by OAuth provider");
            return false;
          }
          
          const existingUser = await prisma.user.findUnique({
            where: { email },
            include: { Account: true },
          });
          
          if (existingUser && account) {
            const hasThisProvider = existingUser.Account.some(
              (acc) => acc.provider === account.provider && acc.providerAccountId === account.providerAccountId
            );
            
            if (!hasThisProvider) {
              console.error(`User ${email} exists but doesn't have ${account.provider} account linked`);
              return false;
            }
            
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
        } catch (error) {
          console.error("Error in signIn callback:", error);
          return false;
        }
      }
      
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        
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
          token.role = user.role;
        }
      }

      if (account?.provider !== "credentials") {
        token.emailVerified = new Date().toISOString();
      }

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
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string;
        session.user.email = token.email as string;
        session.user.role = token.role as string;
        session.user.emailVerified = token.emailVerified as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
    signOut: "/login",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
