import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.scheduleEntry.findMany({
    where: {
      user_id: "cmpmoqr090003jr0961177cr2", // Wait, let's check Walter's ID first. Let's find Walter by name.
    }
  });

  const walter = await prisma.user.findFirst({
    where: { name: { contains: "Walter" } }
  });

  if (!walter) {
    console.log("Walter not found!");
    return;
  }

  console.log("Walter User ID:", walter.id);

  const walterEntries = await prisma.scheduleEntry.findMany({
    where: {
      user_id: walter.id,
      date: {
        gte: new Date("2026-06-01T00:00:00.000Z"),
        lte: new Date("2026-06-30T23:59:59.999Z")
      }
    },
    include: {
      category: true
    },
    orderBy: { date: "asc" }
  });

  console.log("Walter Schedule Entries for June 2026:");
  walterEntries.forEach(e => {
    console.log(`Date: ${e.date.toISOString().slice(0,10)} | Category: ${e.category.name} (${e.category.code}) | Time: ${e.start_time}-${e.end_time} | Note: ${e.note}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
