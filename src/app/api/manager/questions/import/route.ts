import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseQuestions, readSheet } from "@/services/import.service";
import { createQuestion } from "@/services/question.service";
import type { QuestionType } from "@prisma/client";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const form = await req.formData();
    const file = form.get("file");
    const folderId = String(form.get("folderId") ?? "");
    const type = String(form.get("type") ?? "") as QuestionType;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Vui lòng chọn file cần import" }, { status: 400 });
    }
    if (!folderId) {
      return NextResponse.json({ error: "Vui lòng chọn thư mục để import" }, { status: 400 });
    }
    if (!["MCQ4", "TRUE_FALSE", "FILL_BLANK"].includes(type)) {
      return NextResponse.json({ error: "Loại câu hỏi không hợp lệ" }, { status: 400 });
    }

    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      return NextResponse.json({ error: "Thư mục không tồn tại" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let rows: Record<string, unknown>[];
    try {
      rows = readSheet(buffer);
    } catch {
      return NextResponse.json(
        { error: "Không đọc được file. Vui lòng dùng định dạng .xlsx hoặc .csv theo mẫu." },
        { status: 400 },
      );
    }

    const { items, errors } = parseQuestions(rows, type);

    // Cho phép "dry run" để xem trước kết quả
    if (form.get("dryRun") === "1") {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        total: items.length,
        errors,
        preview: items.slice(0, 5),
      });
    }

    const user = await requireRole("MANAGER", "ADMIN");
    let created = 0;
    const failed: { row: number; message: string }[] = [...errors];
    for (const item of items) {
      try {
        await createQuestion(
          folderId,
          {
            content: item.content,
            description: item.description,
            type: item.type,
            options: item.options,
            blanks: item.blanks,
          },
          user.id,
        );
        created += 1;
      } catch (e) {
        failed.push({ row: item.rowNumber, message: (e as Error).message });
      }
    }

    return NextResponse.json({ ok: true, created, errors: failed });
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
