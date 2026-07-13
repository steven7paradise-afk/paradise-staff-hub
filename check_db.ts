import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const setting = await prisma.setting.findUnique({
    where: { key: "mansioni_permissions" }
  });
  console.log(JSON.stringify(setting?.value, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
