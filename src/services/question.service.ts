import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import type { QuestionType } from "@prisma/client";

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  MCQ4: "Trắc nghiệm 4 đáp án",
  TRUE_FALSE: "Trắc nghiệm đúng sai",
  FILL_BLANK: "Điền nội dung còn thiếu",
};

export const QUESTION_TYPE_SHORT: Record<QuestionType, string> = {
  MCQ4: "Trắc nghiệm",
  TRUE_FALSE: "Đúng sai",
  FILL_BLANK: "Điền trống",
};

export const QUESTION_TYPE_COLOR: Record<QuestionType, string> = {
  MCQ4: "blue",
  TRUE_FALSE: "green",
  FILL_BLANK: "orange",
};

export type QuestionInput = {
  content: string;
  description?: string | null;
  type: QuestionType;
  options?: { label: string; isCorrect: boolean }[];
  blanks?: { label: string; isCorrect: boolean }[];
};

function validate(input: QuestionInput): string | null {
  if (!input.content.trim()) return "Nội dung câu hỏi không được để trống";
  if (input.type === "MCQ4") {
    const opts = input.options ?? [];
    if (opts.length !== 4) return "Câu hỏi trắc nghiệm 4 đáp án phải có đúng 4 đáp án";
    if (opts.some((o) => !o.label.trim())) return "Các đáp án không được để trống";
    if (opts.filter((o) => o.isCorrect).length !== 1)
      return "Câu hỏi trắc nghiệm phải có đúng 1 đáp án đúng";
  }
  if (input.type === "TRUE_FALSE") {
    const blanks = input.blanks ?? [];
    if (blanks.length !== 2) return "Câu hỏi đúng sai phải có đúng 2 ý";
    if (blanks.some((b) => !b.label.trim())) return "Các ý không được để trống";
    // mỗi ý phải được chọn đáp án đúng hoặc sai
    if (blanks.some((b) => typeof b.isCorrect !== "boolean"))
      return "Mỗi ý phải được đánh dấu đúng hoặc sai";
  }
  if (input.type === "FILL_BLANK") {
    const blanks = input.blanks ?? [];
    if (blanks.length < 1) return "Câu hỏi điền nội dung còn thiếu phải có ít nhất 1 ô trống";
    if (blanks.some((b) => !b.label.trim())) return "Đáp án điền trống không được để trống";
  }
  return null;
}

export async function createQuestion(
  folderId: string,
  input: QuestionInput,
  createdById?: string,
) {
  const err = validate(input);
  if (err) throw new ValidationError(err);

  return prisma.question.create({
    data: {
      content: input.content.trim(),
      description: input.description?.trim() || null,
      type: input.type,
      folderId,
      createdById,
      ...(input.type === "MCQ4"
        ? {
            options: {
              create: (input.options ?? []).map((o, i) => ({
                label: o.label.trim(),
                isCorrect: o.isCorrect,
                sortOrder: i,
              })),
            },
          }
        : {}),
      ...(input.type === "TRUE_FALSE" || input.type === "FILL_BLANK"
        ? {
            blanks: {
              create: (input.blanks ?? []).map((b, i) => ({
                label: b.label.trim(),
                isCorrect: b.isCorrect,
                sortOrder: i,
              })),
            },
          }
        : {}),
    },
    include: { options: true, blanks: true },
  });
}

export async function updateQuestion(
  questionId: string,
  input: QuestionInput,
) {
  const err = validate(input);
  if (err) throw new ValidationError(err);

  return prisma.$transaction(async (tx) => {
    await tx.questionOption.deleteMany({ where: { questionId } });
    await tx.questionBlank.deleteMany({ where: { questionId } });
    return tx.question.update({
      where: { id: questionId },
      data: {
        content: input.content.trim(),
        description: input.description?.trim() || null,
        type: input.type,
        ...(input.type === "MCQ4"
          ? {
              options: {
                create: (input.options ?? []).map((o, i) => ({
                  label: o.label.trim(),
                  isCorrect: o.isCorrect,
                  sortOrder: i,
                })),
              },
            }
          : {}),
        ...(input.type === "TRUE_FALSE" || input.type === "FILL_BLANK"
          ? {
              blanks: {
                create: (input.blanks ?? []).map((b, i) => ({
                  label: b.label.trim(),
                  isCorrect: b.isCorrect,
                  sortOrder: i,
                })),
              },
            }
          : {}),
      },
      include: { options: true, blanks: true },
    });
  });
}

export async function deleteQuestion(questionId: string) {
  await prisma.question.delete({ where: { id: questionId } });
}

export async function listQuestions(params: {
  folderId?: string;
  type?: QuestionType;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where = {
    ...(params.folderId ? { folderId: params.folderId } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.keyword
      ? { content: { contains: params.keyword, mode: "insensitive" as const } }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        blanks: { orderBy: { sortOrder: "asc" } },
        folder: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.question.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
