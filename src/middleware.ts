import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "tccc_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-change-me-please-0123456789abcdef",
);

async function readUser(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: String(payload.sub),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const user = await readUser(req.cookies.get(COOKIE_NAME)?.value);

  const isLoginPage = pathname === "/login" || pathname === "/register";

  // client: cần đăng nhập
  if (pathname.startsWith("/client")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // manager: cần role MANAGER hoặc ADMIN
  if (pathname.startsWith("/manager")) {
    if (!user) return NextResponse.redirect(new URL("/login", req.url));
    if (user.role !== "MANAGER" && user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/client", req.url));
    }
    return NextResponse.next();
  }

  // admin: cần role ADMIN
  if (pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/login", req.url));
    if (user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/client", req.url));
    }
    return NextResponse.next();
  }

  // đã đăng nhập thì không vào lại trang login
  if (isLoginPage && user) {
    return NextResponse.redirect(
      new URL(user.role === "ADMIN" ? "/admin" : user.role === "MANAGER" ? "/manager" : "/client", req.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/client/:path*",
    "/manager/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
