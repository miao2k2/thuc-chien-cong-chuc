import { PrismaClient, UserRole, QuestionType, PrivateKeyStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function randomCode(prefix = "TCCC") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${out}`;
}

async function upsertFolder(
  name: string,
  parentId: string | null,
  createdById: string,
  description?: string,
) {
  const existing = await prisma.folder.findFirst({ where: { name, parentId } });
  if (existing) return existing;
  return prisma.folder.create({
    data: {
      name,
      parentId,
      description,
      inheritCategoryRoles: true,
      createdById,
    },
  });
}

async function main() {
  // ---------- Users ----------
  const adminPassword = await bcrypt.hash("Abcd@1234", 10);
  const admin = await prisma.user.upsert({
    where: { email: "seoao24@gmail.com" },
    update: { role: UserRole.ADMIN, passwordHash: adminPassword },
    create: {
      email: "seoao24@gmail.com",
      passwordHash: adminPassword,
      fullName: "Quản trị hệ thống",
      role: UserRole.ADMIN,
    },
  });

  const managerPassword = await bcrypt.hash("Abcd@1234", 10);
  const manager = await prisma.user.upsert({
    where: { email: "manager@tccc.local" },
    update: { role: UserRole.MANAGER, passwordHash: managerPassword },
    create: {
      email: "manager@tccc.local",
      passwordHash: managerPassword,
      fullName: "Quản lý nội dung",
      role: UserRole.MANAGER,
    },
  });

  const guestPassword = await bcrypt.hash("Abcd@1234", 10);
  await prisma.user.upsert({
    where: { email: "guest@tccc.local" },
    update: {},
    create: {
      email: "guest@tccc.local",
      passwordHash: guestPassword,
      fullName: "Khách mẫu",
      role: UserRole.GUEST,
    },
  });

  // ---------- Category roles ----------
  const catNames = [
    { name: "Kiến thức chung", description: "Câu hỏi kiến thức nền tảng", color: "#1677ff" },
    { name: "Pháp luật", description: "Các quy định pháp luật áp dụng", color: "#52c41a" },
    { name: "Nghiệp vụ chuyên môn", description: "Kiến thức nghiệp vụ trong công tác", color: "#faad14" },
    { name: "An toàn lao động", description: "An toàn, vệ sinh lao động", color: "#eb2f96" },
  ];
  const catMap = new Map<string, string>();
  for (const c of catNames) {
    const row = await prisma.categoryRole.upsert({
      where: { name: c.name },
      update: { description: c.description, color: c.color },
      create: c,
    });
    catMap.set(c.name, row.id);
  }

  // ---------- Folder tree ----------
  const rootGeneral = await upsertFolder("Kiến thức chung", null, manager.id, "Thư mục gốc");

  const rootLaw = await upsertFolder("Pháp luật", null, manager.id, "Thư mục gốc");

  const rootOps = await upsertFolder("Nghiệp vụ", null, manager.id, "Thư mục gốc");

  const civil = await upsertFolder("Luật Dân sự", rootLaw.id, manager.id);

  const criminal = await upsertFolder("Luật Hình sự", rootLaw.id, manager.id);

  const safety = await upsertFolder("An toàn lao động", rootOps.id, manager.id);

  // gắn category role trực tiếp (thư mục con kế thừa từ cha)
  await prisma.folderCategoryRole.upsert({
    where: { folderId_categoryRoleId: { folderId: rootLaw.id, categoryRoleId: catMap.get("Pháp luật")! } },
    update: {},
    create: { folderId: rootLaw.id, categoryRoleId: catMap.get("Pháp luật")! },
  });
  await prisma.folderCategoryRole.upsert({
    where: { folderId_categoryRoleId: { folderId: rootGeneral.id, categoryRoleId: catMap.get("Kiến thức chung")! } },
    update: {},
    create: { folderId: rootGeneral.id, categoryRoleId: catMap.get("Kiến thức chung")! },
  });
  await prisma.folderCategoryRole.upsert({
    where: { folderId_categoryRoleId: { folderId: rootOps.id, categoryRoleId: catMap.get("Nghiệp vụ chuyên môn")! } },
    update: {},
    create: { folderId: rootOps.id, categoryRoleId: catMap.get("Nghiệp vụ chuyên môn")! },
  });
  // thư mục con gắn thêm role riêng -> vẫn kế thừa role của cha
  await prisma.folderCategoryRole.upsert({
    where: { folderId_categoryRoleId: { folderId: safety.id, categoryRoleId: catMap.get("An toàn lao động")! } },
    update: {},
    create: { folderId: safety.id, categoryRoleId: catMap.get("An toàn lao động")! },
  });

  // ---------- Questions ----------
  const q1 = await prisma.question.create({
    data: {
      content: "Thời hạn kêu cầu giải quyết vụ việc hành chính thông thường là bao lâu kể từ ngày nhận đủ hồ sơ?",
      description:
        "Theo Luật Khiếu nại vụ việc hành chính, thời hạn giải quyết vụ việc hành chính thông thường là 40 ngày kể từ ngày nhận đủ hồ sơ hợp lệ. Trừ trường hợp có quy định riêng của pháp luật.",
      type: QuestionType.MCQ4,
      folderId: rootGeneral.id,
      createdById: manager.id,
      options: {
        create: [
          { label: "30 ngày", isCorrect: false },
          { label: "40 ngày", isCorrect: true },
          { label: "45 ngày", isCorrect: false },
          { label: "60 ngày", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      content:
        "Đối với vụ việc hành chính có tính chất phức tạp, thời hạn giải quyết tối đa là bao lâu?",
      description:
        "Đối với vụ việc hành chính có tính chất phức tạp, thời hạn giải quyết là 60 ngày kể từ ngày nhận đủ hồ sơ hợp lệ.",
      type: QuestionType.MCQ4,
      folderId: rootGeneral.id,
      createdById: manager.id,
      options: {
        create: [
          { label: "40 ngày", isCorrect: false },
          { label: "60 ngày", isCorrect: true },
          { label: "90 ngày", isCorrect: false },
          { label: "120 ngày", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      content: "Người dân có quyền khiếu nại vụ việc hành chính trong những trường hợp nào?",
      description:
        "Người dân có quyền khiếu nại vụ việc hành chính đối với quyết định, hành vi, hành động của cơ quan hành chính hoặc người có thẩm quyền khi có căn cứ cho rằng quyết định, hành vi, hành động đó vi phạm quyền, lợi ích hợp pháp của họ.",
      type: QuestionType.TRUE_FALSE,
      folderId: rootGeneral.id,
      createdById: manager.id,
      blanks: {
        create: [
          { label: "Ý 1", isCorrect: true },
          { label: "Ý 2", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      content:
        "Cơ quan có thẩm quyền xử lý khiếu nại phải thông báo kết quả giải quyết trong thời hạn ____ ngày kể từ ngày nhận được khiếu nại.",
      description:
        "Cơ quan có thẩm quyền xử lý khiếu nại phải thông báo kết quả giải quyết cho người khiếu nại trong thời hạn 05 ngày kể từ ngày nhận được khiếu nại (đối với vụ việc hành chính thông thường) và 07 ngày (đối với vụ việc phức tạp), kể từ ngày nhận đủ hồ sơ hợp lệ.",
      type: QuestionType.FILL_BLANK,
      folderId: rootGeneral.id,
      createdById: manager.id,
      blanks: {
        create: [{ label: "05", isCorrect: true }],
      },
    },
  });

  await prisma.question.create({
    data: {
      content: "Giao dịch dân sự bằng văn bản có giá trị như thế nào trong trường hợp một bên không thiện chí thực hiện?",
      description:
        "Theo Bộ luật Dân sự, giao dịch dân sự bằng văn bản có giá trị như hợp đồng. Trường hợp một bên không thiện chí thực hiện thì bên kia có quyền yêu cầu tòa án buộc bên không thiện chí phải thực hiện nghĩa vụ, bồi thường thiệt hại.",
      type: QuestionType.MCQ4,
      folderId: civil.id,
      createdById: manager.id,
      options: {
        create: [
          { label: "Vô hiệu tuyệt đối", isCorrect: false },
          { label: "Có hiệu lực bắt buộc thi hành", isCorrect: true },
          { label: "Chỉ có giá trị khi có bảo lãnh", isCorrect: false },
          { label: "Cần có xác nhận của cơ quan đăng ký kinh doanh", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      content:
        "Người phạm tội tự nguyện nộp mình cho cơ quan chức năng thì có thể được miễn trừ trách nhiệm hình sự trong trường hợp nào?",
      description:
        "Người phạm tội tự nguyện nộp mình cho cơ quan chức năng và ngăn ngừa được hậu quả của tội phạm thì có thể được miễn trách nhiệm hình sự. Việc thực hiện tự nguyện nộp mình có thể là hình thức báo tin tội phạm.",
      type: QuestionType.TRUE_FALSE,
      folderId: criminal.id,
      createdById: manager.id,
      blanks: {
        create: [
          { label: "Ý 1", isCorrect: true },
          {label: "Ý 2", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      content:
        "Người lao động nữ mang thai được thời gian nghỉ thai sản tối đa là ____ tháng.",
      description:
        "Người lao động nữ mang thai sinh con được nghỉ thai sản 84 ngày (08 tháng tính cả 02 tháng trước và 06 tháng sau), được trả lương theo hợp đồng lao động.",
      type: QuestionType.FILL_BLANK,
      folderId: safety.id,
      createdById: manager.id,
      blanks: {
        create: [{ label: "08", isCorrect: true }],
      },
    },
  });

  // ---------- Exam template mẫu ----------
  const existing = await prisma.examTemplate.findFirst({
    where: { name: "Bài kiểm tra tổng hợp" },
  });
  if (!existing) {
    await prisma.examTemplate.create({
      data: {
        name: "Bài kiểm tra tổng hợp",
        description: "Bài kiểm tra lấy ngẫu nhiên câu hỏi từ các thư mục đã chọn",
        durationMin: 20,
        isPublished: true,
        mode: "RANDOM",
        createdById: manager.id,
        rules: {
          create: [
            { folderId: rootGeneral.id, type: QuestionType.MCQ4, quantity: 5 },
            { folderId: rootGeneral.id, type: QuestionType.TRUE_FALSE, quantity: 5 },
            { folderId: rootGeneral.id, type: QuestionType.FILL_BLANK, quantity: 5 },
          ],
        },
        folders: {
          create: [{ folderId: rootGeneral.id }],
        },
      },
    });
  }

  // ---------- Private keys mẫu ----------
  const keyCount = await prisma.privateKey.count();
  if (keyCount === 0) {
    for (let i = 0; i < 5; i++) {
      await prisma.privateKey.create({
        data: {
          code: randomCode(),
          note: "Key mẫu từ seed",
          status: PrivateKeyStatus.ACTIVE,
          expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
        },
      });
    }
  }

  console.log("✅ Seed thành công");
  console.log("   Admin: seoao24@gmail.com / Abcd@1234");
  console.log("   Manager: manager@tccc.local / Abcd@1234");
  console.log("   Guest: guest@tccc.local / Abcd@1234");
  console.log(`   Private key mẫu: ${await prisma.privateKey.findFirst({ where: { status: PrivateKeyStatus.ACTIVE } }).then((k) => k?.code)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
