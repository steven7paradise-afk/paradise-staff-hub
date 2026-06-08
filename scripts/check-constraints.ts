import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result: any[] = await prisma.$queryRaw`
    SELECT conname, pg_get_constraintdef(con.oid)
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'schedule_categories';
  `;

  console.log("Constraints on schedule_categories:");
  result.forEach(row => {
    console.log(`Name: ${row.conname} | Definition: ${row.pg_get_constraintdef}`);
  });

  const indexes: any[] = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'schedule_categories';
  `;

  console.log("\nIndexes on schedule_categories:");
  indexes.forEach(row => {
    console.log(`Name: ${row.indexname} | Definition: ${row.indexdef}`);
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
