import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const walter = await prisma.user.findFirst({
    where: { name: { contains: "Walter" } }
  });

  if (!walter) {
    console.log("Walter not found!");
    return;
  }

  console.log("Deleting incorrect offset entry for Walter...");
  const result = await prisma.scheduleEntry.deleteMany({
    where: {
      user_id: walter.id,
      date: new Date("2026-06-04T22:00:00.000Z")
    }
  });

  console.log("Deleted count:", result.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
