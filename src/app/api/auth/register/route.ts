import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

const bodySchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  fullName: z.string().optional(),
  privateKey: z.string().min(1, "Vui lòng nhập private key"),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email đã được sử dụng" },
        { status: 409 },
      );
    }

    const key = await prisma.privateKey.findUnique({
      where: { code: body.privateKey.trim().toUpperCase() },
    });
    if (!key) {
      return NextResponse.json(
        { error: "Private key không hợp lệ" },
        { status: 400 },
      );
    }
    if (key.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Private key đã được sử dụng hoặc không còn hiệu lực" },
        { status: 400 },
      );
    }
    if (key.expiresAt.getTime() < Date.now()) {
      await prisma.privateKey.update({
        where: { id: key.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Private key đã hết hạn" },
        { status: 400 },
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(body.password, 10),
        fullName: body.fullName?.trim() || null,
        role: "GUEST",
      },
    });

    await prisma.privateKey.update({
      where: { id: key.id },
      data: { status: "USED", usedById: user.id, usedAt: new Date() },
    });

    await createSession({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
        { status: 400 },
      );
    }
    console.error(e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
