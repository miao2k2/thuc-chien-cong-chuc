import * as XLSX from "xlsx";
import { QUESTION_TYPE_SHORT } from "@/services/question.service";
import type { QuestionType } from "@prisma/client";

export type ParsedQuestion = {
  content: string;
  description?: string | null;
  type: QuestionType;
  options?: { label: string; isCorrect: boolean }[];
  blanks?: { label: string; isCorrect: boolean }[];
  rowNumber: number;
};

export type ParseResult = {
  items: ParsedQuestion[];
  errors: { row: number; message: string }[];
};

/** Đọc file xlsx/csv thành mảng object dựa trên dòng header. */
export function readSheet(fileBuffer: Buffer | ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(fileBuffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function bool(v: unknown): boolean {
  const s = str(v).toLowerCase();
  return s === "1" || s === "true" || s === "có" || s === "yes" || s === "đúng" || s === "x";
}

/**
 * Parse file theo loại câu hỏi. Mỗi loại có 1 format riêng:
 *
 * MCQ4: cột "Nội dung" | "Mô tả" | "A" "B" "C" "D" | "Đáp án đúng" (A/B/C/D)
 * TRUE_FALSE: cột "Nội dung" | "Mô tả" | "Ý 1" "Ý 2" | "Ý 1 đúng" "Ý 2 đúng" (Đúng/Sai)
 * FILL_BLANK: cột "Nội dung" | "Mô tả" | "Đáp án 1" "Đáp án 2" ... | "Ô trống 1" "Ô trống 2" (tên placeholder trong nội dung)
 */
export function parseQuestions(
  rows: Record<string, unknown>[],
  type: QuestionType,
): ParseResult {
  const items: ParsedQuestion[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // header là dòng 1
    const content = str(row["Nội dung"] ?? row["Noi dung"] ?? row["content"]);
    if (!content) {
      errors.push({ row: rowNumber, message: "Thiếu nội dung câu hỏi" });
      return;
    }
    const description = str(row["Mô tả"] ?? row["Mo ta"] ?? row["description"]) || null;

    if (type === "MCQ4") {
      const labels = ["A", "B", "C", "D"].map((k) => str(row[k]));
      if (labels.some((l) => !l)) {
        errors.push({ row: rowNumber, message: "Thiếu đáp án A/B/C/D" });
        return;
      }
      const correctRaw = str(row["Đáp án đúng"] ?? row["Dap an dung"] ?? row["Correct"]).toUpperCase();
      if (!["A", "B", "C", "D"].includes(correctRaw)) {
        errors.push({ row: rowNumber, message: "Đáp án đúng phải là A, B, C hoặc D" });
        return;
      }
      const correctIdx = correctRaw.charCodeAt(0) - 65;
      items.push({
        content,
        description,
        type,
        rowNumber,
        options: labels.map((label, i) => ({ label, isCorrect: i === correctIdx })),
      });
      return;
    }

    if (type === "TRUE_FALSE") {
      const stmts = [str(row["Ý 1"] ?? row["Y 1"] ?? row["Statement 1"]), str(row["Ý 2"] ?? row["Y 2"] ?? row["Statement 2"])];
      if (stmts.some((s) => !s)) {
        errors.push({ row: rowNumber, message: "Thiếu Ý 1 hoặc Ý 2" });
        return;
      }
      const t1 = bool(row["Ý 1 đúng"] ?? row["Y 1 dung"] ?? row["Ý 1 Đúng"] ?? row["Statement 1 Correct"]);
      const t2 = bool(row["Ý 2 đúng"] ?? row["Y 2 dung"] ?? row["Ý 2 Đúng"] ?? row["Statement 2 Correct"]);
      // "Sai" hoặc rỗng => false; phải phân biệt rõ
      const rawT1 = row["Ý 1 đúng"] ?? row["Y 1 dung"] ?? row["Ý 1 Đúng"] ?? row["Statement 1 Correct"];
      const rawT2 = row["Ý 2 đúng"] ?? row["Y 2 dung"] ?? row["Ý 2 Đúng"] ?? row["Statement 2 Correct"];
      if (str(rawT1) === "" || str(rawT2) === "") {
        errors.push({ row: rowNumber, message: "Thiếu đánh dấu đúng/sai cho Ý 1 hoặc Ý 2" });
        return;
      }
      items.push({
        content,
        description,
        type,
        rowNumber,
        blanks: [
          { label: stmts[0], isCorrect: t1 },
          { label: stmts[1], isCorrect: t2 },
        ],
      });
      return;
    }

    // FILL_BLANK
    const answers: string[] = [];
    const markers: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const a = str(row[`Đáp án ${i}`] ?? row[`Dap an ${i}`] ?? row[`Answer ${i}`]);
      const m = str(row[`Ô trống ${i}`] ?? row[`O trong ${i}`] ?? row[`Blank ${i}`]);
      if (!a && !m) break;
      answers.push(a);
      markers.push(m || `____${i}____`);
    }
    if (answers.length === 0) {
      errors.push({ row: rowNumber, message: "Thiếu đáp án điền trống" });
      return;
    }
    items.push({
      content,
      description,
      type,
      rowNumber,
      blanks: answers.map((a) => ({ label: a, isCorrect: true })),
    });
  });

  return { items, errors };
}

// ============================================================
// Template files
// ============================================================

function sheetFromRows(rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: Object.keys(rows[0] ?? {}) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cau hoi");
  return wb;
}

export function buildTemplateWorkbook(type: QuestionType): Buffer {
  let rows: Record<string, unknown>[];
  if (type === "MCQ4") {
    rows = [
      {
        "Nội dung": "Thời hạn giải quyết vụ việc hành chính thông thường là bao lâu?",
        "Mô tả": "Theo Luật Khiếu nại vụ việc hành chính, thời hạn là 40 ngày kể từ ngày nhận đủ hồ sơ hợp lệ.",
        A: "30 ngày",
        B: "40 ngày",
        C: "45 ngày",
        D: "60 ngày",
        "Đáp án đúng": "B",
      },
      {
        "Nội dung": "Cơ quan nào có thẩm quyền xử lý khiếu nại vụ việc hành chính?",
        "Mô tả": "Cơ quan hành chính cấp có thẩm quyền theo quy định.",
        A: "Cơ quan cấp trên",
        B: "Cơ quan cấp dưới",
        C: "Cơ quan được giao nhiệm vụ xử lý",
        D: "Tòa án",
        "Đáp án đúng": "C",
      },
    ];
  } else if (type === "TRUE_FALSE") {
    rows = [
      {
        "Nội dung": "Các ý sau về khiếu nại vụ việc hành chính, ý nào đúng?",
        "Mô tả": "Người dân có quyền khiếu nại khi có căn cứ cho rằng quyết định, hành vi vi phạm quyền, lợi ích hợp pháp của họ.",
        "Ý 1": "Người dân có quyền khiếu nại vụ việc hành chính.",
        "Ý 2": "Mọi người dân đều có quyền khiếu nại với mọi cơ quan nhà nước.",
        "Ý 1 đúng": "Đúng",
        "Ý 2 đúng": "Sai",
      },
      {
        "Nội dung": "Các ý sau về thời hạn khiếu nại, ý nào đúng?",
        "Mô tả": "Thời hạn khiếu nại để yêu cầu cơ quan hành chính giải quyết là 90 ngày kể từ ngày biết hoặc phải biết.",
        "Ý 1": "Thời hạn khiếu nại là 90 ngày kể từ ngày biết hoặc phải biết việc thực hiện.",
        "Ý 2": "Thời hạn khiếu nại không có giới hạn.",
        "Ý 1 đúng": "Đúng",
        "Ý 2 đúng": "Sai",
      },
    ];
  } else {
    rows = [
      {
        "Nội dung":
          "Cơ quan có thẩm quyền xử lý khiếu nại phải thông báo kết quả trong ____ ngày kể từ ngày nhận được khiếu nại.",
        "Mô tả": "Thời hạn thông báo kết quả giải quyết khiếu nại là 05 ngày (thông thường) và 07 ngày (phức tạp).",
        "Đáp án 1": "05",
        "Ô trống 1": "____1____",
      },
      {
        "Nội dung": "Thời hạn khiếu nại để yêu cầu giải quyết vụ việc hành chính là ____ ngày.",
        "Mô tả": "Theo Luật Khiếu nại vụ việc hành chính, thời hạn khiếu nại là 90 ngày.",
        "Đáp án 1": "90",
        "Ô trống 1": "____1____",
      },
    ];
  }
  const wb = sheetFromRows(rows);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  return out;
}

export function templateFileName(type: QuestionType): string {
  const slug: Record<QuestionType, string> = {
    MCQ4: "mau-cau-hoi-trac-nghiem-4-dap-an.xlsx",
    TRUE_FALSE: "mau-cau-hoi-dung-sai.xlsx",
    FILL_BLANK: "mau-cau-hoi-dien-noi-dung-con-thieu.xlsx",
  };
  return slug[type];
}
