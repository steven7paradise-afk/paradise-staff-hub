import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
    }
  });
  console.log("Users in database:", JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
