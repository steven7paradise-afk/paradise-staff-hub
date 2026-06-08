import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.leaveRequest.findMany({
    take: 10,
    orderBy: { created_at: "desc" },
    include: {
      user: {
        select: {
          name: true,
          sede_id: true,
          location: { select: { name: true } }
        }
      }
    }
  });

  console.log("Recent Leave Requests:");
  requests.forEach(r => {
    console.log(`ID: ${r.id} | User: ${r.user.name} | Sede: ${r.user.location?.name} (${r.user.sede_id}) | Type: ${r.type} | Date: ${r.start_date.toISOString().slice(0,10)} to ${r.end_date.toISOString().slice(0,10)} | Status: ${r.status}`);
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
