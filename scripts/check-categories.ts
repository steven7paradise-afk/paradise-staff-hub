import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const locId = "cmpmoqqhg0000jr09c8abcbcq";
  console.log("Categories for Location:", locId);
  const categories = await prisma.scheduleCategory.findMany({
    where: {
      location_id: locId
    }
  });

  categories.forEach(c => {
    console.log(`ID: ${c.id} | Name: ${c.name} | Code: ${c.code} | Active: ${c.active} | LocationId: ${c.location_id}`);
  });

  console.log("\nAll Categories in DB with null location:");
  const nullLocationCats = await prisma.scheduleCategory.findMany({
    where: {
      location_id: null
    }
  });
  nullLocationCats.forEach(c => {
    console.log(`ID: ${c.id} | Name: ${c.name} | Code: ${c.code} | Active: ${c.active}`);
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
