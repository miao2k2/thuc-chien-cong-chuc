import { NextResponse } from "next/server";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createQuestion, updateQuestion, listQuestions } from "@/services/question.service";
import { isValidationError } from "@/lib/errors";
import { z } from "zod";
import type { QuestionType } from "@prisma/client";

export async function GET(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get("type");
    const result = await listQuestions({
      folderId: searchParams.get("folderId") || undefined,
      type: (typeParam as QuestionType | null) ?? undefined,
      keyword: searchParams.get("keyword") || undefined,
      page: Number(searchParams.get("page") || 1),
      pageSize: Math.min(Number(searchParams.get("pageSize") || 20), 500),
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const user = await getCurrentUser();
    const body = await req.json();

    const folderId = String(body.folderId ?? "");
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      return NextResponse.json({ error: "Thư mục không tồn tại" }, { status: 404 });
    }

    const question = await createQuestion(folderId, body, user?.id);
    return NextResponse.json({ ok: true, question });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
        { status: 400 },
      );
    }
    if (isValidationError(e)) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const body = await req.json();
    const questionId = String(body.id ?? "");
    if (!questionId) {
      return NextResponse.json({ error: "Thiếu id câu hỏi" }, { status: 400 });
    }
    const question = await updateQuestion(questionId, body);
    return NextResponse.json({ ok: true, question });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
        { status: 400 },
      );
    }
    if (isValidationError(e)) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    await prisma.question.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
