import { NextResponse } from "next/server";
import { isBusinessEmail, getEmailDomain } from "@/lib/auth-utils";
// Note: You will need to install bcryptjs: npm install bcryptjs && npm install -D @types/bcryptjs
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { signJWT } from "@/lib/jwt";
import { cookies } from "next/headers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const { email, password, name, organizationName, otp, role, companyName, companyEmail, companyAddress, companyPhone } = await req.json();

    // 1. Basic validation
    if (!email || !password || !otp) {
      return NextResponse.json(
        { error: "Email, password, and OTP are required." },
        { status: 400 }
      );
    }

    const ip = getClientIp(req);
    const emailKey = `otp-verify:email:${email.toLowerCase()}`;
    const emailLimit = rateLimit(emailKey, 5, 10 * 60 * 1000);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: `Too many attempts for this email. Try again in ${emailLimit.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    if (ip) {
      const ipLimit = rateLimit(`otp-verify:ip:${ip}`, 20, 10 * 60 * 1000);
      if (!ipLimit.allowed) {
        return NextResponse.json(
          { error: `Too many attempts from this network. Try again in ${ipLimit.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }
    }

    // 2. Verify OTP
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        email,
        token: otp,
        expires: { gte: new Date() },
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid or expired OTP." },
        { status: 400 }
      );
    }

    // 2. Business Email Validation
    if (!isBusinessEmail(email)) {
      return NextResponse.json(
        {
          error: "Personal email addresses are not allowed. Please use your business email.",
        },
        { status: 403 }
      );
    }

    // 3. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 400 }
      );
    }

    // 4. Extract domain and handle Organization
    const domain = getEmailDomain(email);
    const hashedPassword = await bcrypt.hash(password, 12);

    // 5. Create user and organization (Transaction)
    const newUser = await prisma.$transaction(async (tx) => {
      // Find or create organization based on domain
      let organization = await tx.organization.findUnique({
        where: { domain },
      });

      if (!organization) {
        organization = await tx.organization.create({
          data: {
            domain,
            name: organizationName || domain.split(".")[0].toUpperCase(),
          },
        });
      }

      // Create the user
      const user = await tx.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          organizationId: organization.id,
          isEmailVerified: true, // Mark as verified since OTP was correct
          role: role === "VENDOR" ? "VENDOR" : "USER",
          companyName: role === "VENDOR" ? companyName : null,
          companyEmail: role === "VENDOR" ? companyEmail : null,
          companyAddress: role === "VENDOR" ? companyAddress : null,
          companyPhone: role === "VENDOR" ? companyPhone : null,
        },
      });

      // Delete the verification token after successful use
      await tx.verificationToken.deleteMany({
        where: { email },
      });

      return user;
    });

    // 6. Create JWT
    const token = await signJWT({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    // 7. Set Cookie
    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    // 8. Return success (excluding password)
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json(
      {
        message: "Registration successful!",
        user: userWithoutPassword,
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error("Registration Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during registration." },
      { status: 500 }
    );
  }
}
