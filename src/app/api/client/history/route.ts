import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const attempts = await prisma.examAttempt.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        title: true,
        durationMin: true,
        startedAt: true,
        submittedAt: true,
        totalScore: true,
        correctCount: true,
        wrongCount: true,
      },
    });
    return NextResponse.json({ attempts });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
