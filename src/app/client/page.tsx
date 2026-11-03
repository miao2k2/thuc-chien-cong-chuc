import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClientHomeView } from "@/components/client/ClientHomeView";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  GUEST: "Guest",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

export default async function ClientHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [examCount, questionCount, attemptCount, history] = await Promise.all([
    prisma.examTemplate.count({ where: { isPublished: true } }),
    prisma.question.count(),
    prisma.examAttempt.count({ where: { userId: user.id, submittedAt: { not: null } } }),
    prisma.examAttempt.findMany({
      where: { userId: user.id, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        totalScore: true,
        correctCount: true,
        wrongCount: true,
      },
    }),
  ]);

  return (
    <ClientHomeView
      userName={user.fullName || user.email}
      stats={{
        examCount,
        questionCount,
        attemptCount,
        role: ROLE_LABEL[user.role] ?? user.role,
      }}
      history={history}
    />
  );
}
