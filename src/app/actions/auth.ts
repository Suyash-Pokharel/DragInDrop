"use server";

import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { TokenType, Prisma } from "@prisma/client"; // ✅ Kept TokenType
import {
  perIpLimiter,
  perFpLimiter,
  perEmailLimiter,
  perIpLoginLimiter,
  perEmailLoginLimiter,
} from "@/lib/limiter";
import { validatePassword } from "@/lib/password";
import { createSignedToken } from "@/lib/session";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
}

type Result = { success: true } | { success: false; error: string };

/**
 * Register a user (no password written) and send a single-use verification token.
 */
export async function registerUser(
  formData: RegisterData,
  ip?: string,
  fingerprint?: string,
): Promise<Result> {
  const { firstName, lastName, email } = formData;

  if (!firstName || !lastName || !email) {
    return { success: false, error: "Missing required fields." };
  }

  // Normalize and validate email early to avoid duplicates
  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return { success: false, error: "Invalid email address." };
  }

  if (!RESEND_API_KEY || !resend) {
    console.error("Missing RESEND_API_KEY");
    return { success: false, error: "Email service not configured." };
  }

  try {
    // In-memory (Redis) rate-limiter checks (preferred for performance)
    try {
      if (ip) await perIpLimiter.consume(ip);
    } catch {
      return {
        success: false,
        error: "Too many requests from this IP. Try again later.",
      };
    }
    try {
      if (fingerprint) await perFpLimiter.consume(fingerprint);
    } catch {
      return {
        success: false,
        error: "Too many requests from this device. Try again later.",
      };
    }
    try {
      await perEmailLimiter.consume(normalizedEmail);
    } catch {
      return {
        success: false,
        error: "Too many emails sent to this address. Try again later.",
      };
    }
    // If a user exists, allow resend but enforce cooldown; otherwise create user.
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user && user.emailVerified) {
      return { success: false, error: "User already exists with this email." };
    }

    // If user exists and is unverified, enforce a resend cooldown (5 minutes)
    if (user && !user.emailVerified) {
      const recent = await prisma.verificationToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      if (recent) {
        const minBetweenMs = 5 * 60 * 1000; // 5 minutes
        if (Date.now() - recent.createdAt.getTime() < minBetweenMs) {
          return {
            success: false,
            error: "Please wait before requesting another verification email.",
          };
        }
      }
    }

    // Generate a raw token and a SHA-256 hash; store only the hash server-side.
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // record registration attempt by IP if provided
    if (ip) {
      try {
        await prisma.registrationAttempt.create({ data: { ip } });
      } catch (e) {
        console.warn("Failed to record registration attempt", e);
      }
    }
    // Create user and token atomically if user doesn't exist; otherwise create token for existing user.
    if (!user) {
      user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email: normalizedEmail,
          tokens: {
            create: {
              tokenHash,
              expiresAt,
              type: TokenType.VERIFY,
            },
          },
        },
        include: { tokens: true },
      });
    } else {
      // Clean up any existing verification tokens for this user before creating a new one
      try {
        await prisma.verificationToken.deleteMany({
          where: { userId: user.id, type: TokenType.VERIFY },
        });
      } catch (e) {
        console.warn("Failed to delete old verification tokens", e);
      }

      await prisma.verificationToken.create({
        data: {
          tokenHash,
          expiresAt,
          type: TokenType.VERIFY,
          user: { connect: { id: user.id } },
        },
      });
    }

    // escape firstName for safe HTML and url-encode the token
    const safeFirst = (s: string) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    const safeFirstName = safeFirst(firstName);
    const verificationLink = `${APP_URL}/createpassword?token=${encodeURIComponent(rawToken)}`;

    const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Welcome to DragInDrop, ${safeFirstName}!</h2>
          <p>Please verify your email to finish setting up your account.</p>
          <p style="margin: 24px 0;">
            <a href="${verificationLink}" style="background-color: #6666ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Verify Email & Set Password
            </a>
          </p>
          <p style="font-size: 14px; color: #666;">This link expires in 24 hours.</p>
        </div>
      `;

    // Guard against resend being unexpectedly unavailable at send time
    if (!resend) {
      console.error("Resend client missing at send time");
      try {
        await prisma.emailQueue.create({
          data: {
            to: normalizedEmail,
            from: "onboarding@dragindrop.dev",
            subject: "Verify your DragInDrop Account",
            html: emailHtml,
          },
        });
      } catch (qErr) {
        console.error("Failed to enqueue email when Resend missing:", qErr);
      }
    } else {
      try {
        await resend.emails.send({
          from: "onboarding@resend.dev",
          to: normalizedEmail,
          subject: "Verify your DragInDrop Account",
          html: emailHtml,
        });
      } catch (sendErr) {
        console.error("Email send failed, enqueuing:", sendErr);
        // Fallback: enqueue for retry
        try {
          await prisma.emailQueue.create({
            data: {
              to: normalizedEmail,
              from: "onboarding@dragindrop.dev",
              subject: "Verify your DragInDrop Account",
              html: emailHtml,
            },
          });
        } catch (qErr) {
          console.error("Failed to enqueue email:", qErr);
        }
      }
    }

    return { success: true };
  } catch (error: unknown) {
    // ✅ Uses strict 'unknown' from Code 3
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error as Prisma.PrismaClientKnownRequestError).code === "P2002"
    ) {
      return { success: false, error: "User already exists with this email." };
    }

    console.error("Registration Error:", error);
    return { success: false, error: "Internal Server Error" };
  }
}

/**
 * Redeem a verification token and set the user's password.
 */
export async function setPassword(
  token: string,
  password: string,
): Promise<Result & { sessionToken?: string }> {
  if (!token || !password) {
    return { success: false, error: "Missing token or password." };
  }

  try {
    // Hash incoming token and look up by `tokenHash`.
    const incomingHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    const storedToken = await prisma.verificationToken.findFirst({
      where: {
        tokenHash: incomingHash,
        type: TokenType.VERIFY,
      },
      include: { user: true },
    });

    if (!storedToken) {
      return { success: false, error: "Invalid token." };
    }

    if (storedToken.expiresAt < new Date()) {
      return {
        success: false,
        error: "Token has expired. Please register again.",
      };
    }

    // Server-side validation using shared validator
    const { valid } = validatePassword(password);
    if (!valid) {
      return {
        success: false,
        error:
          "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.",
      };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: storedToken.userId },
        data: {
          password: hashedPassword,
          emailVerified: new Date(),
        },
      }),
      prisma.verificationToken.delete({
        where: { id: storedToken.id },
      }),
    ]);

    // Create a simple signed session token (JWT-like) so the client can set a secure HttpOnly cookie.
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      console.warn("Missing SESSION_SECRET; skipping session creation.");
      return { success: true };
    }

    const sessionToken = createSignedToken(
      { sub: storedToken.userId, email: storedToken.user.email },
      secret,
    );

    return { success: true, sessionToken };
  } catch (error: unknown) {
    // ✅ Uses strict 'unknown' from Code 3
    console.error("Set Password Error:", error);
    return { success: false, error: "Failed to set password." };
  }
}

/**
 * Authenticate a user with email + password and return a signed session token.
 */
export async function loginUser(
  email: string,
  password: string,
  ip?: string,
): Promise<Result & { sessionToken?: string }> {
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Rate-limit by IP
    try {
      if (ip) await perIpLoginLimiter.consume(ip);
    } catch {
      return {
        success: false,
        error: "Too many login attempts. Please try again later.",
      };
    }

    // Rate-limit by email
    try {
      await perEmailLoginLimiter.consume(normalizedEmail);
    } catch {
      return {
        success: false,
        error:
          "Too many login attempts for this account. Please try again later.",
      };
    }

    // Look up user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: false, error: "Invalid email or password." };
    }

    // Check if user has verified their email and set a password
    if (!user.emailVerified || !user.password) {
      return {
        success: false,
        error: "Please verify your email and set a password before logging in.",
      };
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { success: false, error: "Invalid email or password." };
    }

    // Create session token
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      console.warn("Missing SESSION_SECRET; cannot create session.");
      return { success: false, error: "Server configuration error." };
    }

    const sessionToken = createSignedToken(
      { sub: user.id, email: user.email },
      secret,
    );

    return { success: true, sessionToken };
  } catch (error: unknown) {
    console.error("Login Error:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}
