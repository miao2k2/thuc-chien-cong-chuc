/* Script kiểm thử end-to-end các luồng chính của hệ thống. */
const BASE = "http://localhost:3100";

function makeJar() {
  return { cookie: "" };
}

async function req(jar, method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (jar.cookie) headers.Cookie = jar.cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) jar.cookie = setCookie.split(";")[0];
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 200);
  }
  return { status: res.status, json };
}

const results = [];
function check(name, cond, extra = "") {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " :: " + extra : ""}`);
}

async function main() {
  // ---------- Admin ----------
  const admin = makeJar();
  let r = await req(admin, "POST", "/api/auth/login", {
    email: "seoao24@gmail.com",
    password: "Abcd@1234",
  });
  check("Admin login", r.status === 200 && r.json.user.role === "ADMIN", JSON.stringify(r.json));

  r = await req(admin, "GET", "/api/admin/users");
  check("Admin list users", r.status === 200 && r.json.users.length > 0, `count=${r.json.users?.length}`);

  // tạo private key
  const expires = new Date(Date.now() + 30 * 86400000).toISOString();
  r = await req(admin, "POST", "/api/admin/private-keys", {
    quantity: 2,
    expiresAt: expires,
    note: "e2e test",
  });
  const keys = r.json.keys || [];
  check("Admin generate private key", r.status === 200 && keys.length === 2, JSON.stringify(r.json).slice(0, 150));

  // ---------- Manager ----------
  const manager = makeJar();
  r = await req(manager, "POST", "/api/auth/login", {
    email: "manager@tccc.local",
    password: "Abcd@1234",
  });
  check("Manager login", r.status === 200 && r.json.user.role === "MANAGER", JSON.stringify(r.json));

  r = await req(manager, "GET", "/api/manager/folders");
  check("Manager get folder tree", r.status === 200 && r.json.tree?.length > 0);
  const tree = r.json.tree;
  const rootGeneral = tree.find((t) => t.name === "Kiến thức chung");
  check("Seed folders present", !!rootGeneral);

  // tạo category role
  const uniq = Date.now();
  r = await req(manager, "POST", "/api/manager/category-roles", {
    name: `E2E Role ${uniq}`,
    description: "role test",
    color: "#ff0000",
  });
  const cat = r.json.categoryRole;
  check("Create category role", r.status === 200 && !!cat?.id, JSON.stringify(r.json).slice(0, 120));

  // tạo thư mục con kế thừa
  r = await req(manager, "POST", "/api/manager/folders", {
    name: `E2E Folder Child ${uniq}`,
    description: "child",
    parentId: rootGeneral.id,
    categoryRoleIds: [cat.id],
    inheritCategoryRoles: true,
  });
  const child = r.json.folder;
  check("Create child folder", r.status === 200 && !!child?.id, JSON.stringify(r.json).slice(0, 120));

  // verify inheritance: child inherits parent role + own role
  r = await req(manager, "GET", "/api/manager/folders");
  const newTree = r.json.tree;
  const found = (function walk(nodes) {
    for (const n of nodes) {
      if (n.id === child.id) return n;
      const f = n.children?.length ? walk(n.children) : null;
      if (f) return f;
    }
    return null;
  })(newTree);
  const parentRoles = rootGeneral.effectiveCategoryRoleIds || [];
  check(
    "Child inherits parent + own category roles",
    found &&
      found.effectiveCategoryRoleIds.includes(cat.id) &&
      parentRoles.every((id) => found.effectiveCategoryRoleIds.includes(id)),
    `child=${found?.effectiveCategoryRoleIds} parent=${parentRoles}`,
  );

  // tạo thư mục không kế thừa
  r = await req(manager, "POST", "/api/manager/folders", {
    name: `E2E Folder NoInherit ${uniq}`,
    parentId: rootGeneral.id,
    categoryRoleIds: [cat.id],
    inheritCategoryRoles: false,
  });
  const noInherit = r.json.folder;
  r = await req(manager, "GET", "/api/manager/folders");
  const noInheritNode = (function walk(nodes) {
    for (const n of nodes) {
      if (n.id === noInherit.id) return n;
      const f = n.children?.length ? walk(n.children) : null;
      if (f) return f;
    }
    return null;
  })(r.json.tree);
  check(
    "Non-inheriting folder uses only own roles",
    noInheritNode &&
      noInheritNode.effectiveCategoryRoleIds.length === 1 &&
      noInheritNode.effectiveCategoryRoleIds[0] === cat.id,
    JSON.stringify(noInheritNode?.effectiveCategoryRoleIds),
  );

  // tạo câu hỏi 3 loại trong thư mục E2E Folder Child
  r = await req(manager, "POST", "/api/manager/questions", {
    folderId: child.id,
    type: "MCQ4",
    content: "E2E: 2 + 2 = ?",
    description: "Giải thích: 2 cộng 2 bằng 4.",
    options: [
      { label: "3", isCorrect: false },
      { label: "4", isCorrect: true },
      { label: "5", isCorrect: false },
      { label: "6", isCorrect: false },
    ],
  });
  check("Create MCQ4 question", r.status === 200 && r.json.question?.id, JSON.stringify(r.json).slice(0, 120));
  const mcq = r.json.question;

  r = await req(manager, "POST", "/api/manager/questions", {
    folderId: child.id,
    type: "TRUE_FALSE",
    content: "E2E: Ý 1 đúng, Ý 2 sai",
    description: "Giải thích E2E.",
    blanks: [
      { label: "Ý 1", isCorrect: true },
      { label: "Ý 2", isCorrect: false },
    ],
  });
  check("Create TRUE_FALSE question", r.status === 200 && r.json.question?.id);
  const tf = r.json.question;

  r = await req(manager, "POST", "/api/manager/questions", {
    folderId: child.id,
    type: "FILL_BLANK",
    content: "E2E: Thủ đô Việt Nam là ____",
    description: "Giải thích E2E.",
    blanks: [{ label: "Hà Nội", isCorrect: true }],
  });
  check("Create FILL_BLANK question", r.status === 200 && r.json.question?.id);
  const fb = r.json.question;

  // validation: MCQ4 phải có đúng 1 đáp án đúng
  r = await req(manager, "POST", "/api/manager/questions", {
    folderId: child.id,
    type: "MCQ4",
    content: "invalid",
    options: [
      { label: "a", isCorrect: true },
      { label: "b", isCorrect: true },
      { label: "c", isCorrect: false },
      { label: "d", isCorrect: false },
    ],
  });
  check("Reject MCQ4 with 2 correct answers", r.status === 400, r.json.error);

  // tải file mẫu
  for (const t of ["MCQ4", "TRUE_FALSE", "FILL_BLANK"]) {
    const res = await fetch(`${BASE}/api/manager/questions/template?type=${t}`, {
      headers: { Cookie: manager.cookie },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    check(
      `Download template ${t}`,
      res.status === 200 && buf.length > 1000 && buf.slice(0, 2).toString() === "PK",
      `size=${buf.length}`,
    );
  }

  // tạo bài thi ngẫu nhiên
  r = await req(manager, "POST", "/api/manager/exams", {
    name: "E2E Bài thi ngẫu nhiên",
    description: "test",
    durationMin: 30,
    isPublished: true,
    mode: "RANDOM",
    rules: [
      { folderId: child.id, type: "MCQ4", quantity: 1 },
      { folderId: child.id, type: "TRUE_FALSE", quantity: 1 },
      { folderId: child.id, type: "FILL_BLANK", quantity: 1 },
    ],
    folderIds: [child.id],
  });
  check("Create RANDOM exam", r.status === 200 && !!r.json.exam?.id, JSON.stringify(r.json).slice(0, 150));
  const exam = r.json.exam;

  // tạo bài thi chỉ định
  r = await req(manager, "POST", "/api/manager/exams", {
    name: "E2E Bài thi chỉ định",
    durationMin: 15,
    mode: "FIXED",
    questionIds: [mcq.id, tf.id, fb.id],
    folderIds: [child.id],
  });
  check("Create FIXED exam", r.status === 200 && !!r.json.exam?.id);

  // ---------- Client: đăng ký với private key ----------
  const client = makeJar();
  const keyCode = keys[0].code;
  r = await req(client, "POST", "/api/auth/register", {
    email: `e2e_${Date.now()}@test.local`,
    password: "Abcd@1234",
    fullName: "E2E Client",
    privateKey: keyCode,
  });
  check("Register with valid private key", r.status === 200 && r.json.user?.role === "GUEST", JSON.stringify(r.json).slice(0, 150));

  // đăng ký lại với cùng key => phải fail
  const client2 = makeJar();
  r = await req(client2, "POST", "/api/auth/register", {
    email: `e2e2_${Date.now()}@test.local`,
    password: "Abcd@1234",
    privateKey: keyCode,
  });
  check("Reject used private key", r.status === 400, r.json.error);

  // đăng ký với key không hợp lệ
  const client3 = makeJar();
  r = await req(client3, "POST", "/api/auth/register", {
    email: `e2e3_${Date.now()}@test.local`,
    password: "Abcd@1234",
    privateKey: "TCCC-XXXXXXXXXXXX",
  });
  check("Reject invalid private key", r.status === 400, r.json.error);

  // client xem catalog
  r = await req(client, "GET", "/api/client/catalog");
  check("Client catalog", r.status === 200 && r.json.exams?.length > 0 && r.json.tree?.length > 0);

  // client tạo bài thi tự do
  r = await req(client, "POST", "/api/client/attempts", {
    title: "E2E Bài tự do",
    durationMin: 20,
    rules: [
      { folderId: child.id, type: "MCQ4", quantity: 1 },
      { folderId: child.id, type: "TRUE_FALSE", quantity: 1 },
      { folderId: child.id, type: "FILL_BLANK", quantity: 1 },
    ],
  });
  check("Client create custom attempt", r.status === 200 && !!r.json.attemptId, JSON.stringify(r.json).slice(0, 150));
  const attemptId = r.json.attemptId;

  // client làm bài từ exam template có sẵn
  r = await req(client, "POST", "/api/client/attempts", {
    examTemplateId: exam.id,
    title: "E2E từ template",
  });
  check("Client start existing exam", r.status === 200 && !!r.json.attemptId);
  const attemptId2 = r.json.attemptId;

  // lấy nội dung attempt, kiểm tra description bị ẩn
  r = await req(client, "GET", `/api/client/attempts/${attemptId}`);
  check("Get attempt data", r.status === 200 && r.json.questions?.length === 3);
  const hasDesc = (r.json.questions || []).some((q) => q.description);
  check("Description hidden during exam", !hasDesc, `descriptions=${hasDesc}`);
  const qlist = r.json.questions;

  // trả lời đúng tất cả
  const answers = [];
  for (const q of qlist) {
    if (q.type === "MCQ4") {
      const opt = (await req(manager, "GET", `/api/manager/questions?folderId=${child.id}&type=MCQ4`)).json.items.find(
        (x) => x.id === q.id,
      );
      answers.push({
        questionId: q.id,
        selectedOptionId: opt.options.find((o) => o.isCorrect).id,
      });
    } else if (q.type === "TRUE_FALSE") {
      const qd = (await req(manager, "GET", `/api/manager/questions?folderId=${child.id}&type=TRUE_FALSE`)).json.items.find(
        (x) => x.id === q.id,
      );
      answers.push({
        questionId: q.id,
        selectedBlankId: qd.blanks.find((b) => b.isCorrect).id,
      });
    } else {
      answers.push({ questionId: q.id, textAnswer: "Hà Nội" });
    }
  }

  // nộp bài thi đúng hết
  r = await req(client, "POST", "/api/client/attempts/submit", {
    attemptId,
    answers,
  });
  check(
    "Submit attempt - all correct",
    r.status === 200 && r.json.correctCount === 3 && r.json.totalScore === 100,
    JSON.stringify(r.json).slice(0, 200),
  );

  // review: description phải hiện
  r = await req(client, "GET", `/api/client/attempts/review?id=${attemptId}`);
  check(
    "Review shows description",
    r.status === 200 && r.json.questions?.some((q) => q.description),
  );
  check("Review perFolder stats", r.status === 200 && r.json.perFolder?.length > 0);

  // nộp bài sai -> kiểm tra perFolder sort sai nhiều trước
  r = await req(client, "POST", "/api/client/attempts/submit", {
    attemptId: attemptId2,
    answers: qlist.map((q) => ({ questionId: q.id, textAnswer: "sai" })),
  });
  check("Submit attempt - all wrong", r.status === 200 && r.json.wrongCount >= 1, JSON.stringify(r.json).slice(0, 200));

  // kiểm tra user khác không xem được attempt của người này
  const other = makeJar();
  await req(other, "POST", "/api/auth/login", { email: "guest@tccc.local", password: "Abcd@1234" });
  r = await req(other, "GET", `/api/client/attempts/review?id=${attemptId}`);
  check("Cannot review others' attempt", r.status === 404, `status=${r.status}`);

  // manager bị chặn khỏi client api? (client api chỉ cần đăng nhập) -> kiểm tra admin api bị chặn
  r = await req(client, "GET", "/api/admin/users");
  check("Client blocked from admin API", r.status === 403, `status=${r.status}`);

  r = await req(client, "GET", "/api/manager/folders");
  check("Client blocked from manager API", r.status === 403, `status=${r.status}`);

  // admin bị khóa bởi manager?
  r = await req(manager, "GET", "/api/admin/users");
  check("Manager blocked from admin API", r.status === 403, `status=${r.status}`);

  // khóa tài khoản
  const targetId = r.status === 200 ? null : null;
  const usersRes = await req(admin, "GET", "/api/admin/users");
  const target = usersRes.json.users.find((u) => u.email.startsWith("e2e_"));
  r = await req(admin, "PATCH", "/api/admin/users", { userId: target.id, isLocked: true });
  check("Admin lock account", r.status === 200 && r.json.user.isLocked === true);

  const locked = makeJar();
  r = await req(locked, "POST", "/api/auth/login", { email: target.email, password: "Abcd@1234" });
  check("Locked account cannot login", r.status === 403, r.json.error);

  // đổi role
  r = await req(admin, "PATCH", "/api/admin/users", { userId: target.id, role: "MANAGER" });
  check("Admin change role", r.status === 200 && r.json.user.role === "MANAGER");

  // admin tự khóa mình => lỗi
  const me = usersRes.json.users.find((u) => u.email === "seoao24@gmail.com");
  r = await req(admin, "PATCH", "/api/admin/users", { userId: me.id, isLocked: true });
  check("Admin cannot lock self", r.status === 400, r.json.error);

  // xóa private key
  r = await req(admin, "DELETE", `/api/admin/private-keys?id=${keys[1].id}`);
  check("Admin delete private key", r.status === 200);

  // dọn dẹp
  await req(manager, "DELETE", `/api/manager/questions?id=${mcq.id}`);
  await req(manager, "DELETE", `/api/manager/questions?id=${tf.id}`);
  await req(manager, "DELETE", `/api/manager/questions?id=${fb.id}`);
  await req(manager, "DELETE", `/api/manager/folders?id=${noInherit.id}`);
  await req(manager, "DELETE", `/api/manager/folders?id=${child.id}`);
  await req(manager, "DELETE", `/api/manager/category-roles?id=${cat.id}`);

  const failed = results.filter((x) => !x.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} tests passed ===`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.name).join("; "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
