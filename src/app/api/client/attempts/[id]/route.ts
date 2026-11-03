import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const attempt = await prisma.examAttempt.findUnique({
      where: { id },
      include: { answers: true },
    });
    if (!attempt || attempt.userId !== user.id) {
      return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
    }

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

    // không trả description khi đang làm bài
    const questions = (snapshot.questions ?? []).map((q) => ({
      id: q.id,
      content: q.content,
      type: q.type,
      folderId: q.folderId,
      folderName: q.folderName,
      options: q.options,
      blanks: q.blanks,
    }));

    const answers = attempt.answers.map((a) => ({
      questionId: a.questionId,
      selectedOptionId: a.selectedOptionId,
      selectedBlankId: a.selectedBlankId,
      textAnswer: a.textAnswer,
    }));

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        title: attempt.title,
        durationMin: attempt.durationMin,
        startedAt: attempt.startedAt,
        expiredAt: attempt.expiredAt,
        submittedAt: attempt.submittedAt,
      },
      questions,
      answers,
    });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
