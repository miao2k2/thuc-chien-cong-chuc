const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.examAttempt
  .findFirst({ orderBy: { startedAt: "desc" }, include: { answers: true } })
  .then((a) =>
    console.log(
      JSON.stringify(
        {
          id: a.id,
          submitted: a.submittedAt,
          score: a.totalScore,
          answers: a.answers.map((x) => ({
            sel: x.selectedOptionId,
            blank: x.selectedBlankId,
            txt: x.textAnswer,
            c: x.isCorrect,
          })),
        },
        null,
        1,
      ),
    ),
  )
  .finally(() => p.$disconnect());
