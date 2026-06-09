import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.leaveRequest.findMany({
    include: {
      user: {
        select: {
          name: true,
          email: true,
        }
      }
    },
    orderBy: {
      created_at: "desc"
    }
  });

  console.log("TOTAL LEAVE REQUESTS:", requests.length);
  
  // Group by user, type, start_date, end_date to find duplicates
  const grouped: Record<string, any[]> = {};
  for (const r of requests) {
    const key = `${r.user_id}-${r.type}-${r.start_date.toISOString().slice(0, 10)}-${r.end_date.toISOString().slice(0, 10)}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(r);
  }

  console.log("\n--- DETAILED LIST ---");
  for (const [key, list] of Object.entries(grouped)) {
    const first = list[0];
    console.log(`Key: ${key} (${list.length} occurences)`);
    console.log(`  User: ${first.user.name} | Type: ${first.type} | Dates: ${first.start_date.toISOString().slice(0,10)} to ${first.end_date.toISOString().slice(0,10)}`);
    for (const item of list) {
      console.log(`    -> ID: ${item.id} | Status: ${item.status} | CreatedAt: ${item.created_at.toISOString()}`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
