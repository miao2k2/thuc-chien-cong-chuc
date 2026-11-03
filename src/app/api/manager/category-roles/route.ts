import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { collectIds } from "@/lib/ids";

export async function GET() {
  try {
    await requireRole("MANAGER", "ADMIN");
    const roles = await prisma.categoryRole.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { folders: true } } },
    });
    return NextResponse.json({ categoryRoles: roles });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

const createSchema = z.object({
  name: z.string().min(1, "Tên không được để trống"),
  description: z.string().optional(),
  color: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const body = createSchema.parse(await req.json());
    const role = await prisma.categoryRole.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        color: body.color || null,
      },
    });
    return NextResponse.json({ ok: true, categoryRole: role });
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
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const body = updateSchema.parse(await req.json());
    const role = await prisma.categoryRole.update({
      where: { id: body.id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined
          ? { description: body.description.trim() || null }
          : {}),
        ...(body.color !== undefined ? { color: body.color || null } : {}),
      },
    });
    return NextResponse.json({ ok: true, categoryRole: role });
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
    await requireRole("MANAGER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const ids = collectIds(searchParams);
    if (ids.length === 0) {
      return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    }
    const res = await prisma.categoryRole.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ ok: true, deleted: res.count });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
