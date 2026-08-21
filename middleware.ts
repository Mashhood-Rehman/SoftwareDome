import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-at-least-32-chars-long"
);

const ADMIN_ONLY_PREFIXES = [
  "/dashboard/users",
  "/dashboard/blogs",
  "/dashboard/settings",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    try {
      const { payload } = await jwtVerify(token, secret);
      const role = payload.role as string;

      if (role !== "ADMIN" && role !== "VENDOR") {
        return NextResponse.redirect(new URL("/", request.url));
      }

      if (role === "VENDOR" && ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.delete("auth_token");
      return response;
    }
  }

  if (pathname.startsWith("/categories/") && !pathname.includes("/page/")) {
    const pageParam = request.nextUrl.searchParams.get("page");
    const q = request.nextUrl.searchParams.get("q");
    const pageNum = pageParam ? parseInt(pageParam, 10) : 1;

    if (!q && pageNum > 1) {
      const url = request.nextUrl.clone();
      url.pathname = `${pathname}/page/${pageNum}`;
      url.searchParams.delete("page");
      return NextResponse.redirect(url, 301);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/categories/:path*"],
};
