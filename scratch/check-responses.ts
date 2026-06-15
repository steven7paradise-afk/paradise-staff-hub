import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const responses = await prisma.serviceFormResponse.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    include: {
      form: true,
      user: true
    }
  });
  for (const r of responses) {
    console.log(`Response ID: ${r.id}`);
    console.log(`Form: ${r.form?.name}`);
    console.log(`Created: ${r.created_at}`);
    console.log(`Answers:`, JSON.stringify(r.answers, null, 2));
    console.log('----------------------------------------------------');
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
