import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { collectIds } from "@/lib/ids";

export async function GET() {
  try {
    await requireRole("MANAGER", "ADMIN");
    const exams = await prisma.examTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        rules: { include: { folder: true, categoryRole: true } },
        folders: { include: { folder: true } },
        items: { include: { question: { select: { id: true, content: true, type: true } } } },
        _count: { select: { items: true } },
      },
    });
    return NextResponse.json({ exams });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

const ruleSchema = z.object({
  folderId: z.string().nullable().optional(),
  categoryRoleId: z.string().nullable().optional(),
  type: z.enum(["MCQ4", "TRUE_FALSE", "FILL_BLANK"]).nullable().optional(),
  quantity: z.number().int().min(0),
});

const createSchema = z.object({
  name: z.string().min(1, "Tên bài thi không được để trống"),
  description: z.string().optional(),
  durationMin: z.number().int().min(1).nullable().optional(),
  isPublished: z.boolean().optional(),
  mode: z.enum(["FIXED", "RANDOM"]).optional(),
  rules: z.array(ruleSchema).optional(),
  folderIds: z.array(z.string()).optional(),
  questionIds: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("MANAGER", "ADMIN");
    const body = createSchema.parse(await req.json());
    const mode = body.mode ?? "RANDOM";

    if (mode === "FIXED" && (!body.questionIds || body.questionIds.length === 0)) {
      return NextResponse.json(
        { error: "Bài thi chế độ chỉ định cần ít nhất 1 câu hỏi" },
        { status: 400 },
      );
    }
    if (mode === "RANDOM" && (!body.rules || body.rules.length === 0)) {
      return NextResponse.json(
        { error: "Bài thi chế độ ngẫu nhiên cần ít nhất 1 quy tắc chọn câu hỏi" },
        { status: 400 },
      );
    }

    const exam = await prisma.examTemplate.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        durationMin: body.durationMin ?? null,
        isPublished: body.isPublished ?? true,
        mode,
        createdById: user.id,
        rules: body.rules?.length
          ? {
              create: body.rules.map((r) => ({
                folderId: r.folderId ?? null,
                categoryRoleId: r.categoryRoleId ?? null,
                type: r.type ?? null,
                quantity: r.quantity,
              })),
            }
          : undefined,
        folders: body.folderIds?.length
          ? { create: body.folderIds.map((id) => ({ folderId: id })) }
          : undefined,
        items: body.questionIds?.length
          ? {
              create: body.questionIds.map((id, i) => ({
                questionId: id,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: { rules: true, folders: true, items: true },
    });
    return NextResponse.json({ ok: true, exam });
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
  durationMin: z.number().int().min(1).nullable().optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const body = updateSchema.parse(await req.json());
    const exam = await prisma.examTemplate.update({
      where: { id: body.id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined
          ? { description: body.description.trim() || null }
          : {}),
        ...(body.durationMin !== undefined ? { durationMin: body.durationMin } : {}),
        ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
      },
    });
    return NextResponse.json({ ok: true, exam });
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
    const res = await prisma.examTemplate.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ ok: true, deleted: res.count });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
