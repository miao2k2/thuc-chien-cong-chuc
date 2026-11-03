/* Dọn dữ liệu test E2E còn sót lại trong DB. */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const folders = await prisma.folder.findMany({
    where: { name: { startsWith: "E2E Folder" } },
    select: { id: true, name: true },
  });
  for (const f of folders) {
    await prisma.question.deleteMany({ where: { folderId: f.id } });
    await prisma.folder.delete({ where: { id: f.id } });
  }
  const cats = await prisma.categoryRole.findMany({
    where: { name: { startsWith: "E2E Role" } },
    select: { id: true },
  });
  for (const c of cats) await prisma.categoryRole.delete({ where: { id: c.id } });

  const exams = await prisma.examTemplate.findMany({
    where: { name: { startsWith: "E2E" } },
    select: { id: true },
  });
  for (const e of exams) await prisma.examTemplate.delete({ where: { id: e.id } });

  const users = await prisma.user.findMany({
    where: { email: { startsWith: "e2e" } },
    select: { id: true },
  });
  for (const u of users) {
    await prisma.examAttempt.deleteMany({ where: { userId: u.id } });
    await prisma.privateKey.updateMany({
      where: { usedById: u.id },
      data: { status: "ACTIVE", usedById: null, usedAt: null },
    });
    await prisma.user.delete({ where: { id: u.id } });
  }

  const keys = await prisma.privateKey.findMany({
    where: { note: "e2e test" },
    select: { id: true },
  });
  for (const k of keys) await prisma.privateKey.delete({ where: { id: k.id } });

  console.log("Đã dọn dẹp:", {
    folders: folders.length,
    categories: cats.length,
    exams: exams.length,
    users: users.length,
    keys: keys.length,
  });
  await prisma.$disconnect();
})();
