import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildRandomQuestions,
  createAttempt,
  loadQuestionsByIds,
  type RuleInput,
} from "@/services/exam.service";
import { z } from "zod";

const bodySchema = z.object({
  examTemplateId: z.string().nullable().optional(),
  title: z.string().min(1, "Vui lòng nhập tên bài thi"),
  durationMin: z.number().int().min(1).nullable().optional(),
  // bài tạo tự do: rules = số lượng câu theo từng loại + thư mục
  rules: z
    .array(
      z.object({
        folderId: z.string().nullable().optional(),
        categoryRoleId: z.string().nullable().optional(),
        type: z.enum(["MCQ4", "TRUE_FALSE", "FILL_BLANK"]).nullable().optional(),
        quantity: z.number().int().min(0),
      }),
    )
    .optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());

    let questionIds: string[] = [];
    let title = body.title.trim();
    let durationMin = body.durationMin ?? null;
    let examTemplateId: string | null = body.examTemplateId ?? null;

    if (examTemplateId) {
      const template = await prisma.examTemplate.findUnique({
        where: { id: examTemplateId },
        include: { rules: true, items: { include: { question: true } } },
      });
      if (!template) {
        return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
      }
      if (!template.isPublished) {
        return NextResponse.json({ error: "Bài thi không còn khả dụng" }, { status: 403 });
      }
      title = title || template.name;
      durationMin = durationMin ?? template.durationMin;

      if (template.mode === "FIXED") {
        questionIds = template.items.map((i) => i.questionId);
      } else {
        questionIds = await buildRandomQuestions(
          template.rules.map((r) => ({
            folderId: r.folderId,
            categoryRoleId: r.categoryRoleId,
            type: r.type,
            quantity: r.quantity,
          })),
        );
      }
    } else {
      const rules = (body.rules ?? []).filter((r) => r.quantity > 0);
      if (rules.length === 0) {
        return NextResponse.json(
          { error: "Vui lòng chọn ít nhất 1 loại câu hỏi với số lượng > 0" },
          { status: 400 },
        );
      }
      questionIds = await buildRandomQuestions(rules as RuleInput[]);
    }

    if (questionIds.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy câu hỏi phù hợp với lựa chọn của bạn" },
        { status: 400 },
      );
    }

    const questions = await loadQuestionsByIds(questionIds);
    const attemptId = await createAttempt({
      userId: user.id,
      examTemplateId,
      title,
      durationMin,
      questions,
    });

    return NextResponse.json({ ok: true, attemptId, questionCount: questions.length });
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
