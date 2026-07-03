import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const closures = await prisma.serviceFormResponse.findMany({
    where: {
      form: {
        is: {
          OR: [
            { name: { contains: "chiusura cassa", mode: "insensitive" } },
            { category: { contains: "cassa", mode: "insensitive" } },
          ],
        },
      },
    },
    include: { form: true },
    orderBy: { created_at: "desc" },
    take: 5,
  });

  console.log(JSON.stringify(closures.map(c => ({
    id: c.id,
    created_at: c.created_at,
    form_name: c.form?.name,
    user_location_name: c.user_location_name
  })), null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
