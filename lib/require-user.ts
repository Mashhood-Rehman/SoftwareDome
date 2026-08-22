import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/jwt";

export type UserSession = {
  userId: string;
  email: string;
  role: string;
};

type UserAuthResult =
  | { session: UserSession; error?: never }
  | { session?: never; error: NextResponse };

export async function requireUser(): Promise<UserAuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return {
      error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const payload = await verifyJWT(token);

  if (!payload?.userId) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    };
  }

  return {
    session: {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
    },
  };
}
