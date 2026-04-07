import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Email Queue Worker - Processes failed emails from the EmailQueue table
 * 
 * This route is triggered by Vercel Cron Job every 3 minutes.
 * It fetches all EmailQueue records with attempts < 3, attempts to resend them,
 * deletes successful sends, increments attempts on failures, and removes records
 * with attempts >= 3.
 * 
 * Security: Verifies request is from Vercel Cron using authorization header
 */
export async function GET(request: NextRequest) {
  // Verify request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!RESEND_API_KEY || !resend) {
    console.error("Missing RESEND_API_KEY - cannot process email queue");
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    );
  }

  const prisma = getPrisma();
  
  try {
    // Fetch all EmailQueue records with attempts < 3
    const queuedEmails = await prisma.emailQueue.findMany({
      where: {
        attempts: {
          lt: 3
        }
      }
    });

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      deleted: 0
    };

    // Process each queued email
    for (const email of queuedEmails) {
      results.processed++;

      try {
        // Attempt to send email using Resend API
        await resend.emails.send({
          from: email.from,
          to: email.to,
          subject: email.subject,
          html: email.html
        });

        // On success, delete the EmailQueue record
        await prisma.emailQueue.delete({
          where: { id: email.id }
        });

        results.succeeded++;
        console.log(`Successfully sent email to ${email.to}, deleted from queue`);
      } catch (error) {
        // On failure, increment attempts counter
        const newAttempts = email.attempts + 1;

        if (newAttempts >= 3) {
          // Delete records with attempts >= 3
          await prisma.emailQueue.delete({
            where: { id: email.id }
          });
          results.deleted++;
          console.error(`Email to ${email.to} failed after 3 attempts, deleted from queue:`, error);
        } else {
          // Increment attempts
          await prisma.emailQueue.update({
            where: { id: email.id },
            data: { attempts: newAttempts }
          });
          results.failed++;
          console.error(`Email to ${email.to} failed (attempt ${newAttempts}/3):`, error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Email queue processed",
      results
    });
  } catch (error) {
    console.error("Error processing email queue:", error);
    return NextResponse.json(
      { error: "Failed to process email queue" },
      { status: 500 }
    );
  }
}
