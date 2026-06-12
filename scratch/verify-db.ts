import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Connecting to Database via Prisma...");
  const users = await prisma.user.findMany({
    where: { active: true },
    take: 5,
    select: { id: true, name: true, role: true, sede_id: true }
  });
  console.log("=== Active Users ===");
  console.table(users);
  
  if (users.length > 0) {
    const user = users[0];
    console.log(`Verifying queries for user: ${user.name}`);
    
    const countSched = await prisma.scheduleEntry.count({ where: { user_id: user.id } });
    console.log(`- Schedule Entries: ${countSched}`);

    const countHours = await prisma.workHourRecord.count({ where: { user_id: user.id } });
    console.log(`- Work Hour Records: ${countHours}`);

    const countLogs = await prisma.attendanceLog.count({ where: { user_id: user.id } });
    console.log(`- Attendance Logs: ${countLogs}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
