import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.serviceFormResponse.findUnique({
    where: { id: "cmr4xvzaw003olb091zjw8nk2" }
  });
  if (res) {
    console.log("Answers:", JSON.stringify(res.answers, null, 2));
  } else {
    console.log("Response not found");
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
