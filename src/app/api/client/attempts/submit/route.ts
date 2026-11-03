import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const submitSchema = z.object({
  attemptId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOptionId: z.string().nullable().optional(),
        selectedBlankId: z.string().nullable().optional(),
        textAnswer: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = submitSchema.parse(await req.json());

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: body.attemptId },
    });
    if (!attempt || attempt.userId !== user.id) {
      return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
    }
    if (attempt.submittedAt) {
      return NextResponse.json({ error: "Bài thi đã được nộp" }, { status: 409 });
    }

    const { gradeAndSave } = await import("@/services/exam.service");
    const result = await gradeAndSave(body.attemptId, body.answers);

    return NextResponse.json({
      ok: true,
      total: result.total,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      totalScore: result.totalScore,
      perFolder: result.perFolder,
    });
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
