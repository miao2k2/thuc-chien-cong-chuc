import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { buildTemplateWorkbook, templateFileName } from "@/services/import.service";
import type { QuestionType } from "@prisma/client";

export async function GET(req: Request) {
  try {
    await requireRole("MANAGER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const type = String(searchParams.get("type") ?? "") as QuestionType;
    if (!["MCQ4", "TRUE_FALSE", "FILL_BLANK"].includes(type)) {
      return NextResponse.json({ error: "Loại câu hỏi không hợp lệ" }, { status: 400 });
    }
    const buffer = buildTemplateWorkbook(type);
    const filename = templateFileName(type);
    const asciiName = filename.replace(/[^\x20-\x7E]/g, "-").replace(/"/g, "");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (e) {
    const status = (e as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
