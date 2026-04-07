import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { getPrisma } from "@/lib/prisma"
import { authConfig } from "./auth.config"
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// Add full providers list with Node-specific Prisma dependencies
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(getPrisma() as any),
  providers: [
    ...authConfig.providers.filter((p: any) => p.id !== "credentials"),
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

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        const prisma = getPrisma();
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          throw new Error("Invalid email or password");
        }

        if (!user.emailVerified) {
          throw new Error("Please verify your email and set a password before logging in.");
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        return user;
      },
    }),
  ],
})
