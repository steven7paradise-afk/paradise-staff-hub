import { prisma } from "@/lib/prisma";
import { calculateClockHours } from "@/lib/work-hours";

export function attendanceDayStart(date: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(date);
  return new Date(`${day}T00:00:00.000Z`);
}

export async function unlockWorkHourRecord(userId: string, date: Date) {
  const day = attendanceDayStart(date);
  const record = await prisma.workHourRecord.findUnique({
    where: { user_id_date: { user_id: userId, date: day } },
    select: { paid_break: true },
  });
  if (!record) return;

  const logs = await prisma.attendanceLog.findMany({
    where: { user_id: userId, date: day },
    select: { type: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });
  const clock = calculateClockHours(logs);

  await prisma.workHourRecord.update({
    where: { user_id_date: { user_id: userId, date: day } },
    data: {
      hours: record.paid_break ? clock.grossHours : clock.netHours,
      manual_override: false,
    },
  });
}
