import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Session, SessionUser, UserRole } from "@/types/auth";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "tccc_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-change-me-please-0123456789abcdef",
);

function ttlHours(): number {
  const raw = Number(process.env.AUTH_TOKEN_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : 12;
}

export async function createSession(user: SessionUser): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours() * 3600 * 1000);
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      user: {
        id: String(payload.sub),
        email: String(payload.email),
        fullName: payload.fullName ? String(payload.fullName) : null,
        role: payload.role as UserRole,
      },
      expiresAt: new Date(Number(payload.exp) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHORIZED", "Cần đăng nhập");
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthError("FORBIDDEN", "Bạn không có quyền thực hiện tác vụ này");
  }
  return user;
}

export class AuthError extends Error {
  constructor(
    public code: "UNAUTHORIZED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
  }
}

/** Đọc lại user trực tiếp từ DB — dùng khi cần dữ liệu mới nhất (khóa tài khoản, đổi role). */
export async function getFreshUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, fullName: true, role: true, isLocked: true },
  });
}
