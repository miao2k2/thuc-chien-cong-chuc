import { buildTemplateWorkbook } from "@/services/import.service";
import { QuestionType } from "@prisma/client";

const types = [QuestionType.MCQ4, QuestionType.TRUE_FALSE, QuestionType.FILL_BLANK];
for (const t of types) {
  try {
    const buf = buildTemplateWorkbook(t);
    console.log(t, "OK", buf.length, buf.slice(0, 2).toString());
  } catch (e) {
    console.error(t, "FAIL", e);
  }
}
