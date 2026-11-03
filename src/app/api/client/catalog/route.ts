import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFolderTree } from "@/services/folder.service";

export async function GET() {
  try {
    await requireUser();
    const [tree, exams, categoryRoles] = await Promise.all([
      getFolderTree(),
      prisma.examTemplate.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: "desc" },
        include: {
          rules: { include: { folder: true, categoryRole: true } },
          folders: { include: { folder: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.categoryRole.findMany({ orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ tree, exams, categoryRoles });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
