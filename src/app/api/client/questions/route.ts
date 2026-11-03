import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listQuestions } from "@/services/question.service";
import type { QuestionType } from "@prisma/client";

export async function GET(req: Request) {
  try {
    await requireUser();
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
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
