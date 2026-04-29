"use server";

import { getPrisma } from "@/lib/prisma";
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

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface RegisterData {
  name: string;
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
  const { name, email } = formData;

  if (!name || !email) {
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
    const prisma = getPrisma();

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
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // record registration attempt by IP if provided
    if (ip) {
      try {
        await prisma.registrationAttempt.create({ 
          data: { 
            id: crypto.randomUUID(),
            ip 
          } 
        });
      } catch (e) {
        console.warn("Failed to record registration attempt", e);
      }
    }
    // Create user and token atomically if user doesn't exist; otherwise create token for existing user.
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          name,
          email: normalizedEmail,
          updatedAt: new Date(),
          VerificationToken: {
            create: {
              id: crypto.randomUUID(),
              tokenHash,
              expiresAt,
              type: TokenType.VERIFY,
            },
          },
        },
        include: { VerificationToken: true },
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
          id: crypto.randomUUID(),
          tokenHash,
          expiresAt,
          type: TokenType.VERIFY,
          userId: user.id,
        },
      });
    }

    // escape name for safe HTML and url-encode the token
    const safeFirst = (s: string) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    // Extract first name from full name for greeting
    const firstName = name.split(" ")[0];
    const safeFirstName = safeFirst(firstName);
    const verificationLink = `${APP_URL}/createpassword?token=${encodeURIComponent(rawToken)}`;

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #6666ff; font-size: 28px; font-weight: bold;">DragInDrop</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Welcome, ${safeFirstName}!</h2>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Thank you for signing up for DragInDrop. To complete your registration and set up your account, please verify your email address by clicking the button below.
              </p>
              <!-- Button -->
              <table role="presentation" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${verificationLink}" style="display: inline-block; background-color: #6666ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">Verify Email & Set Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                This verification link will expire in 24 hours. If you didn't create an account with DragInDrop, you can safely ignore this email.
              </p>
              <!-- Alternative Link -->
              <p style="margin: 20px 0 0 0; color: #999999; font-size: 12px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${verificationLink}" style="color: #6666ff; word-break: break-all;">${verificationLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #eeeeee; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999999; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} DragInDrop. All rights reserved.<br>
                This is an automated message, please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

    // Send verification email using Resend
    if (!resend) {
      console.error("Resend client missing at send time");
      return { success: false, error: "Email service not configured." };
    }

    try {
      console.log("[REGISTRATION] Attempting to send email to:", normalizedEmail);
      console.log("[REGISTRATION] From address:", "DragInDrop <onboarding@contact.suyash-pokharel.com.np>");
      
      const emailResult = await resend.emails.send({
        from: "DragInDrop <onboarding@contact.suyash-pokharel.com.np>",
        to: normalizedEmail,
        subject: "Verify your DragInDrop Account",
        html: emailHtml,
        text: `Welcome to DragInDrop, ${safeFirstName}!

Thank you for signing up. To complete your registration and set up your account, please verify your email address.

Verify your email and set your password by visiting this link:
${verificationLink}

This verification link will expire in 24 hours.

If you didn't create an account with DragInDrop, you can safely ignore this email.

---
© ${new Date().getFullYear()} DragInDrop. All rights reserved.
This is an automated message, please do not reply to this email.`,
      });
      
      console.log("[REGISTRATION] Email sent successfully!");
      console.log("[REGISTRATION] Email ID:", emailResult.data?.id);
      console.log("[REGISTRATION] Email error:", emailResult.error);
    } catch (sendErr) {
      console.error("[REGISTRATION] Email send failed:", sendErr);
      return { success: false, error: "Failed to send verification email. Please try again." };
    }

    return { success: true };
  } catch (error: unknown) {
    // ✅ Uses strict 'unknown' from Code 3
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "User already exists with this email." };
    }

    console.error("Registration Error:", error);
    return { success: false, error: "Internal Server Error" };
  }
}

/**
 * Redeem a verification token and set the user's password.
 * After successful password set, the client should call NextAuth signIn.
 */
export async function setPassword(
  token: string,
  password: string,
): Promise<Result & { email?: string }> {
  if (!token || !password) {
    return { success: false, error: "Missing token or password." };
  }

  try {
    // Hash incoming token and look up by `tokenHash`.
    const prisma = getPrisma();

    const incomingHash = crypto.createHash("sha256").update(token).digest("hex");
    const storedToken = await prisma.verificationToken.findFirst({
      where: {
        tokenHash: incomingHash,
        type: TokenType.VERIFY,
      },
      include: { User: true },
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

    // Return user email so client can call NextAuth signIn
    return { success: true, email: storedToken.User.email };
  } catch (error: unknown) {
    console.error("Set Password Error:", error);
    return { success: false, error: "Failed to set password." };
  }
}

/**
 * @deprecated This function is deprecated and will be removed in favor of NextAuth.
 * Use NextAuth's Credentials Provider instead.
 * See: src/app/api/auth/[...nextauth]/route.ts
 *
 * Authenticate a user with email + password.
 * This function is no longer used after NextAuth migration.
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
        error: "Too many login attempts for this account. Please try again later.",
      };
    }

    // Look up user
    const prisma = getPrisma();
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

    // Session management is now handled by NextAuth
    // This function should not be used - use NextAuth signIn instead
    return {
      success: false,
      error: "This login method is deprecated. Please use NextAuth signIn.",
    };
  } catch (error: unknown) {
    console.error("Login Error:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Request a password reset email for a user.
 */
export async function requestPasswordReset(email: string): Promise<Result> {
  if (!email) {
    return { success: false, error: "Email is required." };
  }

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
    // Rate-limit password reset requests
    try {
      await perEmailLimiter.consume(normalizedEmail);
    } catch {
      return {
        success: false,
        error: "Too many password reset requests. Try again later.",
      };
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // For security, always return success even if user doesn't exist
    // This prevents email enumeration attacks
    if (!user) {
      return { success: true };
    }

    // Check if user has verified their email
    if (!user.emailVerified) {
      return { success: false, error: "Please verify your email first." };
    }

    // Check for recent password reset requests (5 minute cooldown)
    const recent = await prisma.verificationToken.findFirst({
      where: { userId: user.id, type: TokenType.RESET_PASSWORD },
      orderBy: { createdAt: "desc" },
    });

    if (recent) {
      const minBetweenMs = 5 * 60 * 1000; // 5 minutes
      if (Date.now() - recent.createdAt.getTime() < minBetweenMs) {
        return {
          success: false,
          error: "Please wait before requesting another password reset.",
        };
      }
    }

    // Generate reset token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Clean up old reset tokens
    await prisma.verificationToken.deleteMany({
      where: { userId: user.id, type: TokenType.RESET_PASSWORD },
    });

    // Create new reset token
    await prisma.verificationToken.create({
      data: {
        id: crypto.randomUUID(),
        tokenHash,
        expiresAt,
        type: TokenType.RESET_PASSWORD,
        userId: user.id,
      },
    });

    // Prepare email
    const safeFirst = (s: string) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const firstName = user.name?.split(" ")[0] || "User";
    const safeFirstName = safeFirst(firstName);
    const resetLink = `${APP_URL}/resetpassword?token=${encodeURIComponent(rawToken)}`;

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #6666ff; font-size: 28px; font-weight: bold;">DragInDrop</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Password Reset Request</h2>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Hi ${safeFirstName},
              </p>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                We received a request to reset the password for your DragInDrop account. Click the button below to create a new password.
              </p>
              <!-- Button -->
              <table role="presentation" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; background-color: #6666ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                This password reset link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              <!-- Alternative Link -->
              <p style="margin: 20px 0 0 0; color: #999999; font-size: 12px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetLink}" style="color: #6666ff; word-break: break-all;">${resetLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #eeeeee; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999999; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} DragInDrop. All rights reserved.<br>
                This is an automated message, please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email
    try {
      console.log("[PASSWORD RESET] Attempting to send email to:", normalizedEmail);
      console.log("[PASSWORD RESET] From address:", "DragInDrop <onboarding@contact.suyash-pokharel.com.np>");
      
      const emailResult = await resend.emails.send({
        from: "DragInDrop <onboarding@contact.suyash-pokharel.com.np>",
        to: normalizedEmail,
        subject: "Reset Your DragInDrop Password",
        html: emailHtml,
        text: `Password Reset Request

Hi ${safeFirstName},

We received a request to reset the password for your DragInDrop account. Click the link below to create a new password:

${resetLink}

This password reset link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
© ${new Date().getFullYear()} DragInDrop. All rights reserved.
This is an automated message, please do not reply to this email.`,
      });
      
      console.log("[PASSWORD RESET] Email sent successfully!");
      console.log("[PASSWORD RESET] Email ID:", emailResult.data?.id);
      console.log("[PASSWORD RESET] Email error:", emailResult.error);
    } catch (sendErr) {
      console.error("[PASSWORD RESET] Email send failed:", sendErr);
      return { success: false, error: "Failed to send password reset email. Please try again." };
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Password Reset Request Error:", error);
    return { success: false, error: "Internal Server Error" };
  }
}

/**
 * Reset a user's password using a reset token.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<Result & { email?: string }> {
  if (!token || !newPassword) {
    return { success: false, error: "Missing token or password." };
  }

  try {
    const prisma = getPrisma();

    // Hash incoming token and look up
    const incomingHash = crypto.createHash("sha256").update(token).digest("hex");
    const storedToken = await prisma.verificationToken.findFirst({
      where: {
        tokenHash: incomingHash,
        type: TokenType.RESET_PASSWORD,
      },
      include: { User: true },
    });

    if (!storedToken) {
      return { success: false, error: "Invalid or expired reset link." };
    }

    if (storedToken.expiresAt < new Date()) {
      return {
        success: false,
        error: "Reset link has expired. Please request a new one.",
      };
    }

    // Validate password
    const { valid } = validatePassword(newPassword);
    if (!valid) {
      return {
        success: false,
        error:
          "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.",
      };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and delete token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: storedToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.verificationToken.delete({
        where: { id: storedToken.id },
      }),
    ]);

    return { success: true, email: storedToken.User.email };
  } catch (error: unknown) {
    console.error("Reset Password Error:", error);
    return { success: false, error: "Failed to reset password." };
  }
}
