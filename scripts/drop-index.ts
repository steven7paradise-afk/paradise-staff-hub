import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Dropping index schedule_categories_code_key...");
  await prisma.$executeRaw`DROP INDEX IF EXISTS schedule_categories_code_key;`;
  console.log("Index dropped successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
