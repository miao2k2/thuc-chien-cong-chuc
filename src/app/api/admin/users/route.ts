import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isLocked: true,
        createdAt: true,
        privateKeys: {
          where: { status: "USED" },
          select: { id: true, code: true, expiresAt: true },
          orderBy: { usedAt: "desc" },
          take: 1,
        },
      },
    });
    return NextResponse.json({ users });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

const updateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["GUEST", "MANAGER", "ADMIN"]).optional(),
  isLocked: z.boolean().optional(),
  newPassword: z.string().min(6).optional(),
});

export async function PATCH(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const body = updateSchema.parse(await req.json());

    if (body.userId === admin.id && body.isLocked) {
      return NextResponse.json(
        { error: "Không thể tự khóa tài khoản của chính mình" },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id: body.userId },
      data: {
        ...(body.role ? { role: body.role } : {}),
        ...(typeof body.isLocked === "boolean" ? { isLocked: body.isLocked } : {}),
        ...(body.newPassword
          ? { passwordHash: await hash(body.newPassword, 10) }
          : {}),
      },
      select: { id: true, email: true, role: true, isLocked: true },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
        { status: 400 },
      );
    }
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
