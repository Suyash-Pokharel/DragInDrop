import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

// We import this purely for type safety where needed, but we don't import the Prisma Adapter here.
// Doing so ensures this file remains strictly edge-compatible for middleware use.

export const authConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          firstName: profile.given_name,
          lastName: profile.family_name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // To make authorize work edge-friendly or standalone, we dynamically fetch user here
        // We will fetch from our API or just rely on the auth.ts Node version if needed.
        // Actually, since Next.js server actions / route handlers run in Node runtime (except Edge runtime),
        // we can safely import prisma here. BUT wait, auth.config.ts is imported in middleware!
        // To avoid importing prisma in middleware, we should put the authorize function's Prisma logic 
        // into auth.ts or dynamically import it.
        
        return null; // Will be properly overridden in auth.ts
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login", // Error code passed in query string as ?error=
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      if (token.role && session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role as string;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;
