import { NextResponse } from "next/server";
import { isBusinessEmail } from "@/lib/auth-utils";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { sendOTPEmail } from "@/lib/mail";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const { email, type } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const ip = getClientIp(req);
    const emailKey = `send-otp:email:${email.toLowerCase()}`;
    const emailLimit = rateLimit(emailKey, 3, 10 * 60 * 1000);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: `Too many OTP requests for this email. Try again in ${emailLimit.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    const ipLimit = rateLimit(`send-otp:ip:${ip}`, 10, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: `Too many OTP requests from this network. Try again in ${ipLimit.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    // 1. Business Email Validation
    if (!isBusinessEmail(email)) {
      return NextResponse.json(
        { error: "SoftwareDome requires a business email (e.g., name@company.com)." },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (type === 'login' && !user) {
      return NextResponse.json(
        { error: "No account found with this email. Please sign up first." },
        { status: 404 }
      );
    }

    if (type === 'signup' && user) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 400 }
      );
    }

    // 2. Generate a 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // 3. Store OTP in database
    await prisma.verificationToken.upsert({
      where: {
        email_token: {
          email,
          token: otp,
        },
      },
      update: {
        token: otp,
        expires,
      },
      create: {
        email,
        token: otp,
        expires,
      },
    });

    await sendOTPEmail(email, otp);

    return NextResponse.json(
      { message: "OTP sent successfully to your business email." },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("OTP Error:", error);
    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 }
    );
  }
}
