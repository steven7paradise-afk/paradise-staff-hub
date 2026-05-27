import { LeaveType, type PrismaClient } from "@prisma/client";

const leaveTypeCategory: Record<LeaveType, { code: string; name: string; color: string; text_color: string }> = {
  FERIE: { code: "F", name: "Ferie", color: "#F4CCCC", text_color: "#5E1F1F" },
  PERMESSO: { code: "PE", name: "Permesso", color: "#D9EAD3", text_color: "#23451F" },
  RIPOSO: { code: "R", name: "Riposo", color: "#FFF2CC", text_color: "#4A3900" },
  MALATTIA: { code: "ML", name: "Malattia", color: "#E00000", text_color: "#FFFFFF" },
  ALTRO: { code: "A", name: "Altro", color: "#EADCF8", text_color: "#33213F" },
};

function atStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetweenInclusive(startDate: Date, endDate: Date) {
  const days: Date[] = [];
  const cursor = atStartOfDay(startDate);
  const end = atStartOfDay(endDate);

  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export async function syncApprovedLeaveToSchedule(
  prisma: PrismaClient,
  leaveRequestId: string,
  approverId: string,
) {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: { user: true },
  });

  if (!leaveRequest) {
    throw new Error("Richiesta non trovata");
  }

  const categorySeed = leaveTypeCategory[leaveRequest.type];
  const existingCategory = await prisma.scheduleCategory.findFirst({
    where: {
      code: categorySeed.code,
      location_id: leaveRequest.user.sede_id,
    },
  });
  const category = existingCategory
    ? await prisma.scheduleCategory.update({
        where: { id: existingCategory.id },
        data: {
          name: categorySeed.name,
          color: categorySeed.color,
          text_color: categorySeed.text_color,
          active: true,
          location_id: leaveRequest.user.sede_id,
        },
      })
    : await prisma.scheduleCategory.create({
        data: {
          ...categorySeed,
          location_id: leaveRequest.user.sede_id,
        },
      });

  const days = daysBetweenInclusive(leaveRequest.start_date, leaveRequest.end_date);
  const note = `Richiesta ${categorySeed.name.toLowerCase()} approvata da ${approverId}`;

  await prisma.$transaction(
    days.map((date) =>
      prisma.scheduleEntry.upsert({
        where: {
          user_id_date: {
            user_id: leaveRequest.user_id,
            date,
          },
        },
        update: {
          category_id: category.id,
          location_id: leaveRequest.user.sede_id,
          note,
        },
        create: {
          user_id: leaveRequest.user_id,
          location_id: leaveRequest.user.sede_id,
          category_id: category.id,
          date,
          note,
        },
      }),
    ),
  );

  return { syncedDays: days.length, categoryCode: category.code };
}
