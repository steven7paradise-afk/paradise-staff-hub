import { LeaveType, type PrismaClient, type ScheduleCategory } from "@prisma/client";

const leaveTypeCategory: Record<LeaveType, { code: string; name: string; color: string; text_color: string }> = {
  FERIE: { code: "F", name: "Ferie", color: "#F4CCCC", text_color: "#5E1F1F" },
  PERMESSO: { code: "P", name: "Permesso", color: "#D9EAD3", text_color: "#23451F" },
  RIPOSO: { code: "R", name: "Riposo", color: "#FFF2CC", text_color: "#4A3900" },
  MALATTIA: { code: "M", name: "Malattia", color: "#E00000", text_color: "#FFFFFF" },
  ALTRO: { code: "A", name: "Altro", color: "#EADCF8", text_color: "#33213F" },
};

function atStartOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetweenInclusive(startDate: Date, endDate: Date) {
  const days: Date[] = [];
  const cursor = atStartOfDay(startDate);
  const end = atStartOfDay(endDate);

  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export async function syncApprovedLeaveToSchedule(
  prisma: any,
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

  const categorySeed = leaveTypeCategory[leaveRequest.type as LeaveType];
  const allCategories = (await prisma.scheduleCategory.findMany({
    where: {
      location_id: leaveRequest.user.sede_id,
    },
  })) as ScheduleCategory[];

  let matchingCategory = null;
  const type = leaveRequest.type; // FERIE, PERMESSO, RIPOSO, MALATTIA, ALTRO

  if (type === "FERIE") {
    matchingCategory = allCategories.find((c) => c.code === "F" || c.code === "FE" || c.name.toLowerCase().includes("ferie"));
  } else if (type === "PERMESSO") {
    matchingCategory = allCategories.find((c) => c.code === "P" || c.code === "PE" || c.name.toLowerCase().includes("permesso"));
  } else if (type === "RIPOSO") {
    matchingCategory = allCategories.find((c) => c.code === "R" || c.code === "RI" || c.code === "R3" || c.name.toLowerCase().includes("riposo"));
  } else if (type === "MALATTIA") {
    matchingCategory = allCategories.find((c) => c.code === "M" || c.code === "MA" || c.code === "ML" || c.name.toLowerCase().includes("malattia"));
  } else {
    matchingCategory = allCategories.find((c) => c.code === "A" || c.name.toLowerCase().includes("altro"));
  }

  let category;
  if (matchingCategory) {
    category = await prisma.scheduleCategory.update({
      where: { id: matchingCategory.id },
      data: {
        active: true,
      },
    });
  } else {
    const existingCode = allCategories.find((c) => c.code === categorySeed.code);
    if (existingCode) {
      category = await prisma.scheduleCategory.update({
        where: { id: existingCode.id },
        data: {
          active: true,
        },
      });
    } else {
      category = await prisma.scheduleCategory.create({
        data: {
          code: categorySeed.code,
          name: categorySeed.name,
          color: categorySeed.color,
          text_color: categorySeed.text_color,
          active: true,
          location_id: leaveRequest.user.sede_id,
        },
      });
    }
  }

  const days = daysBetweenInclusive(leaveRequest.start_date, leaveRequest.end_date);
  const timeNote = leaveRequest.start_time && leaveRequest.end_time ? ` (${leaveRequest.start_time}-${leaveRequest.end_time})` : "";
  const note = `Richiesta ${categorySeed.name.toLowerCase()}${timeNote} approvata da ${approverId}`;

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
          start_time: leaveRequest.start_time,
          end_time: leaveRequest.end_time,
          note,
        },
        create: {
          user_id: leaveRequest.user_id,
          location_id: leaveRequest.user.sede_id,
          category_id: category.id,
          date,
          start_time: leaveRequest.start_time,
          end_time: leaveRequest.end_time,
          note,
        },
      }),
    ),
  );

  return { syncedDays: days.length, categoryCode: category.code };
}
