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

  // Find Lavoro (L2) category for Walter's location (Ufficio Paradise)
  const l2Category = await prisma.scheduleCategory.findFirst({
    where: {
      code: "L2",
      location_id: walter.sede_id
    }
  });

  if (!l2Category) {
    console.log("L2 category not found!");
    return;
  }

  console.log("Updating Walter's June 4th entry to Lavoro (L2)...");
  await prisma.scheduleEntry.update({
    where: {
      user_id_date: {
        user_id: walter.id,
        date: new Date("2026-06-04T00:00:00.000Z")
      }
    },
    data: {
      category_id: l2Category.id,
      start_time: "09:00",
      end_time: "18:00",
      note: null
    }
  });

  console.log("Clean up finished!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
