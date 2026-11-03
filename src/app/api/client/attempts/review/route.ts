import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAttemptForReview } from "@/services/exam.service";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

    const attempt = await getAttemptForReview(id, user.id);
    if (!attempt) {
      return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
    }

    // lấy lại dữ liệu câu hỏi (kèm description để hiện khi review)
    const snapshot = attempt.snapshot as unknown as {
      questions: {
        id: string;
        content: string;
        description: string | null;
        type: string;
        folderId: string;
        folderName: string;
        options: { id: string; label: string }[];
        blanks: { id: string; label: string }[];
      }[];
    };

    const ids = snapshot.questions.map((q) => q.id);
    const dbQuestions = await prisma.question.findMany({
      where: { id: { in: ids } },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        blanks: { orderBy: { sortOrder: "asc" } },
        folder: { select: { name: true } },
      },
    });
    const dbMap = new Map(dbQuestions.map((q) => [q.id, q]));

    const questions = snapshot.questions.map((q) => {
      const full = dbMap.get(q.id);
      const answer = attempt.answers.find((a) => a.questionId === q.id);
      return {
        ...q,
        description: full?.description ?? q.description,
        options: full?.options ?? q.options,
        blanks: full?.blanks ?? q.blanks,
        answer: answer
          ? {
              selectedOptionId: answer.selectedOptionId,
              selectedBlankId: answer.selectedBlankId,
              textAnswer: answer.textAnswer,
              isCorrect: answer.isCorrect,
            }
          : null,
      };
    });

    // thống kê sai theo thư mục, sắp xếp sai nhiều nhất trước
    const agg = new Map<
      string,
      { folderId: string; folderName: string; total: number; wrong: number }
    >();
    for (const q of questions) {
      const item = agg.get(q.folderId) ?? {
        folderId: q.folderId,
        folderName: q.folderName,
        total: 0,
        wrong: 0,
      };
      item.total += 1;
      if (!q.answer?.isCorrect) item.wrong += 1;
      agg.set(q.folderId, item);
    }
    const perFolder = Array.from(agg.values()).sort(
      (a, b) => b.wrong - a.wrong || b.total - a.total,
    );

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        title: attempt.title,
        durationMin: attempt.durationMin,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        totalScore: attempt.totalScore,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
      },
      questions,
      perFolder,
    });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
