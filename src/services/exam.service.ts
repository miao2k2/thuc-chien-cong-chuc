import { prisma } from "@/lib/prisma";
import type { Question, QuestionType } from "@prisma/client";

export type ExamSnapshotQuestion = {
  id: string;
  content: string;
  description: string | null;
  type: QuestionType;
  folderId: string;
  folderName: string;
  options: { id: string; label: string }[];
  blanks: { id: string; label: string }[];
};

export type ExamSnapshot = {
  questions: ExamSnapshotQuestion[];
};

export type RuleInput = {
  folderId?: string | null;
  categoryRoleId?: string | null;
  type?: QuestionType | null;
  quantity: number;
};

export type AttemptPayload = {
  title: string;
  durationMin?: number | null;
  questions: ExamSnapshotQuestion[];
};

function toSnapshotQuestion(q: {
  id: string;
  content: string;
  description: string | null;
  type: QuestionType;
  folderId: string;
  folder: { name: string };
  options: { id: string; label: string }[];
  blanks: { id: string; label: string }[];
}): ExamSnapshotQuestion {
  return {
    id: q.id,
    content: q.content,
    description: q.description,
    type: q.type,
    folderId: q.folderId,
    folderName: q.folder.name,
    options: q.options,
    blanks: q.blanks,
  };
}

const QUESTION_INCLUDE = {
  folder: { select: { name: true } },
  options: { orderBy: { sortOrder: "asc" as const } },
  blanks: { orderBy: { sortOrder: "asc" as const } },
};

/** Lấy ngẫu nhiên N câu theo rule (folder / categoryRole / loại). */
async function pickRandom(
  rule: RuleInput,
  takenIds: Set<string>,
  count: number,
): Promise<string[]> {
  if (count <= 0) return [];
  const where: Record<string, unknown> = {
    id: { notIn: Array.from(takenIds) },
  };
  if (rule.folderId) where.folderId = rule.folderId;
  if (rule.type) where.type = rule.type;

  const candidates = await prisma.question.findMany({
    where,
    select: { id: true },
  });
  let pool = candidates.map((c) => c.id);

  if (rule.categoryRoleId) {
    // lọc theo category role hiệu lực của các folder thuộc rule
    const folders = await prisma.folder.findMany({
      where: rule.folderId ? { id: rule.folderId } : {},
      select: { id: true, parentId: true, inheritCategoryRoles: true, categoryRoles: { select: { categoryRoleId: true } } },
    });
    const byId = new Map(folders.map((f) => [f.id, f]));
    const effective = (id: string): string[] => {
      const f = byId.get(id);
      if (!f) return [];
      const direct = f.categoryRoles.map((c) => c.categoryRoleId);
      if (!f.inheritCategoryRoles) return direct;
      if (!f.parentId) return direct;
      const parent = byId.get(f.parentId);
      if (!parent) return direct;
      return Array.from(new Set([...effective(parent.id), ...direct]));
    };
    const allowed = new Set(
      folders.filter((f) => effective(f.id).includes(rule.categoryRoleId!)).map((f) => f.id),
    );
    if (allowed.size > 0) {
      const filtered = await prisma.question.findMany({
        where: { ...where, folderId: { in: Array.from(allowed) } },
        select: { id: true },
      });
      pool = filtered.map((c) => c.id);
    } else {
      pool = [];
    }
  }

  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, count);
  picked.forEach((id) => takenIds.add(id));
  return picked;
}

/** Sinh danh sách câu hỏi từ các rule ngẫu nhiên. */
export async function buildRandomQuestions(rules: RuleInput[]): Promise<string[]> {
  const taken = new Set<string>();
  const ids: string[] = [];
  for (const rule of rules) {
    const picked = await pickRandom(rule, taken, rule.quantity);
    ids.push(...picked);
  }
  return ids;
}

/** Lấy câu hỏi theo id list, giữ thứ tự đã chọn. */
export async function loadQuestionsByIds(ids: string[]): Promise<ExamSnapshotQuestion[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.question.findMany({
    where: { id: { in: ids } },
    include: QUESTION_INCLUDE,
  });
  const map = new Map<string, (typeof rows)[number]>(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => map.get(id))
    .filter((r): r is (typeof rows)[number] => Boolean(r))
    .map(toSnapshotQuestion);
}

export async function createAttempt(params: {
  userId: string;
  examTemplateId?: string | null;
  title: string;
  durationMin?: number | null;
  questions: ExamSnapshotQuestion[];
}): Promise<string> {
  const now = new Date();
  const expiredAt = params.durationMin ? new Date(now.getTime() + params.durationMin * 60000) : null;
  const attempt = await prisma.examAttempt.create({
    data: {
      userId: params.userId,
      examTemplateId: params.examTemplateId ?? null,
      title: params.title,
      durationMin: params.durationMin ?? null,
      startedAt: now,
      expiredAt,
      snapshot: { questions: params.questions } satisfies ExamSnapshot,
    },
  });
  return attempt.id;
}

export type AnswerInput = {
  questionId: string;
  selectedOptionId?: string | null;
  selectedBlankId?: string | null;
  textAnswer?: string | null;
};

/** Kiểm tra câu đã trả lời hay chưa. */
export function isAnswered(q: ExamSnapshotQuestion, a?: AnswerInput | null): boolean {
  if (!a) return false;
  if (q.type === "MCQ4") return Boolean(a.selectedOptionId);
  if (q.type === "TRUE_FALSE") return Boolean(a.selectedBlankId);
  return Boolean(a.textAnswer && a.textAnswer.trim().length > 0);
}

/** Chấm điểm 1 câu. */
export async function gradeQuestion(
  questionId: string,
  answer: AnswerInput,
): Promise<{ isCorrect: boolean; folderId: string }> {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    include: { options: true, blanks: true },
  });
  if (!q) return { isCorrect: false, folderId: "" };

  let isCorrect = false;
  if (q.type === "MCQ4" && answer.selectedOptionId) {
    const opt = q.options.find((o) => o.id === answer.selectedOptionId);
    isCorrect = Boolean(opt?.isCorrect);
  } else if (q.type === "TRUE_FALSE" && answer.selectedBlankId) {
    const blank = q.blanks.find((b) => b.id === answer.selectedBlankId);
    isCorrect = Boolean(blank?.isCorrect);
  } else if (q.type === "FILL_BLANK" && answer.textAnswer) {
    const normalize = (s: string) =>
      s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]$/g, "");
    const given = normalize(answer.textAnswer);
    isCorrect = q.blanks.some((b) => normalize(b.label) === given);
  }
  return { isCorrect, folderId: q.folderId };
}

export type GradeResult = {
  total: number;
  correctCount: number;
  wrongCount: number;
  totalScore: number;
  perFolder: {
    folderId: string;
    folderName: string;
    total: number;
    wrong: number;
  }[];
  details: {
    questionId: string;
    isCorrect: boolean;
    folderId: string;
    folderName: string;
  }[];
};

/** Chấm toàn bộ bài, lưu answers + cập nhật tổng điểm. */
export async function gradeAndSave(
  attemptId: string,
  answers: AnswerInput[],
): Promise<GradeResult> {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true },
  });
  if (!attempt) throw new Error("Không tìm thấy bài thi");

  const snapshot = attempt.snapshot as unknown as ExamSnapshot;
  const questions = snapshot.questions ?? [];

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const details: GradeResult["details"] = [];
  const folderAgg = new Map<string, { folderName: string; total: number; wrong: number }>();

  const graded: {
    q: ExamSnapshotQuestion;
    ans: AnswerInput | undefined;
    isCorrect: boolean;
  }[] = [];
  for (const q of questions) {
    const ans = answerMap.get(q.id);
    const answered = isAnswered(q, ans);
    const { isCorrect } = answered
      ? await gradeQuestion(q.id, ans!)
      : { isCorrect: false };
    const agg = folderAgg.get(q.folderId) ?? {
      folderName: q.folderName,
      total: 0,
      wrong: 0,
    };
    agg.total += 1;
    if (!isCorrect) agg.wrong += 1;
    folderAgg.set(q.folderId, agg);
    details.push({
      questionId: q.id,
      isCorrect,
      folderId: q.folderId,
      folderName: q.folderName,
    });
    graded.push({ q, ans, isCorrect });
  }

  const correctCount = details.filter((d) => d.isCorrect).length;
  const total = details.length;
  const wrongCount = total - correctCount;
  const totalScore = total === 0 ? 0 : Math.round((correctCount / total) * 10000) / 100;

  // xoá answer cũ rồi ghi lại
  await prisma.$transaction(async (tx) => {
    await tx.answer.deleteMany({ where: { attemptId } });
    if (graded.length > 0) {
      await tx.answer.createMany({
        data: graded.map(({ q, ans, isCorrect }) => ({
          attemptId,
          questionId: q.id,
          selectedOptionId: ans?.selectedOptionId ?? null,
          selectedBlankId: ans?.selectedBlankId ?? null,
          textAnswer: ans?.textAnswer ?? null,
          isCorrect,
          folderId: q.folderId,
        })),
      });
    }
    await tx.examAttempt.update({
      where: { id: attemptId },
      data: {
        submittedAt: new Date(),
        correctCount,
        wrongCount,
        totalScore,
      },
    });
  });

  const perFolder = Array.from(folderAgg.entries()).map(([folderId, v]) => ({
    folderId,
    ...v,
  }));
  // sắp xếp: sai nhiều hơn lên trước
  perFolder.sort((a, b) => b.wrong - a.wrong || b.total - a.total);

  return { total, correctCount, wrongCount, totalScore, perFolder, details };
}

/** Đếm số câu chưa trả lời. */
export function countUnanswered(
  questions: ExamSnapshotQuestion[],
  answers: AnswerInput[],
): number {
  const map = new Map(answers.map((a) => [a.questionId, a]));
  return questions.filter((q) => !isAnswered(q, map.get(q.id))).length;
}

export async function getAttemptForReview(attemptId: string, userId: string) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true },
  });
  if (!attempt || attempt.userId !== userId) return null;
  return attempt;
}
