import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generatePrivateKeyCode } from "@/lib/private-key";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const keys = await prisma.privateKey.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        usedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    return NextResponse.json({ keys });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

const createSchema = z.object({
  quantity: z.number().int().min(1).max(100).default(1),
  expiresAt: z.string().min(1, "Vui lòng chọn thời hạn hết hạn"),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const body = createSchema.parse(await req.json());
    const expiresAt = new Date(body.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json({ error: "Thời hạn không hợp lệ" }, { status: 400 });
    }

    const rows = [];
    for (let i = 0; i < body.quantity; i++) {
      rows.push({
        code: generatePrivateKeyCode(),
        note: body.note?.trim() || null,
        status: "ACTIVE" as const,
        expiresAt,
      });
    }
    await prisma.privateKey.createMany({ data: rows });
    const created = await prisma.privateKey.findMany({
      where: { code: { in: rows.map((r) => r.code) } },
    });
    return NextResponse.json({ ok: true, count: created.length, keys: created });
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

const updateSchema = z.object({
  keyId: z.string().min(1),
  expiresAt: z.string().optional(),
  note: z.string().optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "REVOKED", "USED"]).optional(),
});

export async function PATCH(req: Request) {
  try {
    await requireRole("ADMIN");
    const body = updateSchema.parse(await req.json());
    const data: Record<string, unknown> = {};
    if (body.expiresAt) {
      const d = new Date(body.expiresAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Thời hạn không hợp lệ" }, { status: 400 });
      }
      data.expiresAt = d;
    }
    if (body.note !== undefined) data.note = body.note;
    if (body.status) data.status = body.status;

    const key = await prisma.privateKey.update({ where: { id: body.keyId }, data });
    return NextResponse.json({ ok: true, key });
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

export async function DELETE(req: Request) {
  try {
    await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    }
    await prisma.privateKey.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
