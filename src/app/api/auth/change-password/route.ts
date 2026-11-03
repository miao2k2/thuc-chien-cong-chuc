import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
  newPassword: z.string().min(6, "Mật khẩu mới phải có ít nhất 6 ký tự"),
  confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu mới"),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
    }

    const body = bodySchema.parse(await req.json());

    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json(
        { error: "Xác nhận mật khẩu không khớp" },
        { status: 400 },
      );
    }

    if (body.currentPassword === body.newPassword) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải khác mật khẩu hiện tại" },
        { status: 400 },
      );
    }

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!record) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
    }

    const ok = await bcrypt.compare(body.currentPassword, record.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Mật khẩu hiện tại không đúng" },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(body.newPassword, 10) },
    });

    return NextResponse.json({ ok: true });
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
