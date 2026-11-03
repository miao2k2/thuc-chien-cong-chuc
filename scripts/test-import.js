/**
 * Test đầy đủ luồng import: tải template -> điền -> import -> kiểm tra DB.
 * Chạy với: node scripts/test-import.js
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const BASE = "http://localhost:3100";

async function req(cookie, method, p, body) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + p, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 200);
  }
  return { status: res.status, json };
}

(async () => {
  // login manager
  const l = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "manager@tccc.local", password: "Abcd@1234" }),
  });
  const cookie = l.headers.get("set-cookie").split(";")[0];

  // lấy folder
  const folders = await req(cookie, "GET", "/api/manager/folders");
  const root = folders.json.tree.find((t) => t.name === "Kiến thức chung");

  // tải template MCQ4
  const tplRes = await fetch(BASE + "/api/manager/questions/template?type=MCQ4", {
    headers: { Cookie: cookie },
  });
  const buf = Buffer.from(await tplRes.arrayBuffer());
  const tmp = path.join(__dirname, "..", ".tmp-template.xlsx");
  fs.writeFileSync(tmp, buf);
  console.log("Tải template OK:", buf.length, "bytes");

  // đọc template, điền thêm 2 câu
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  console.log("Header template:", Object.keys(rows[0]));
  console.log("Số dòng mẫu:", rows.length);

  rows.push({
    "Nội dung": "Câu import tự động số 1",
    "Mô tả": "Mô tả import",
    A: "Đáp án A",
    B: "Đáp án B",
    C: "Đáp án C",
    D: "Đáp án D",
    "Đáp án đúng": "C",
  });
  rows.push({
    "Nội dung": "Câu import tự động số 2",
    "Mô tả": "",
    A: "A1",
    B: "B1",
    C: "C1",
    D: "D1",
    "Đáp án đúng": "A",
  });

  const outWb = XLSX.utils.book_new();
  const outWs = XLSX.utils.json_to_sheet(rows, { header: Object.keys(rows[0]) });
  XLSX.utils.book_append_sheet(outWb, outWs, "Cau hoi");
  const importBuf = XLSX.write(outWb, { bookType: "xlsx", type: "buffer" });
  fs.writeFileSync(tmp, importBuf);

  // import
  const fd = new FormData();
  fd.append("file", new Blob([importBuf]), "import-test.xlsx");
  fd.append("folderId", root.id);
  fd.append("type", "MCQ4");
  const imp = await fetch(BASE + "/api/manager/questions/import", {
    method: "POST",
    headers: { Cookie: cookie },
    body: fd,
  });
  const impJson = await imp.json();
  console.log("Import:", imp.status, JSON.stringify(impJson).slice(0, 300));

  // verify
  const list = await req(cookie, "GET", `/api/manager/questions?keyword=Câu import tự động`);
  console.log("Câu hỏi sau import:", list.json.items?.length);
  for (const q of list.json.items || []) {
    console.log(
      `  - "${q.content}" | desc=${JSON.stringify(q.description)} | options=${
        q.options?.length
      } | correct=${q.options?.filter((o) => o.isCorrect).map((o) => o.label).join(",")}`,
    );
  }

  // dọn dẹp
  for (const q of list.json.items || []) {
    await req(cookie, "DELETE", `/api/manager/questions?id=${q.id}`);
  }
  fs.unlinkSync(tmp);
  console.log("Đã dọn dẹp");
})();
