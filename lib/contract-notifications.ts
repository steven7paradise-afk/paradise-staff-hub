import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

function daysUntil(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export async function ensureContractExpiryNotifications() {
  const expiringUsers = await prisma.user.findMany({
    where: {
      active: true,
      contract_end: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lte: new Date(Date.now() + 7 * 86_400_000),
      },
    },
    include: { location: true },
  });
  if (expiringUsers.length === 0) return;

  const recipients = await prisma.user.findMany({
    where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"] } },
    select: { id: true, role: true, sede_id: true },
  });

  for (const worker of expiringUsers) {
    const days = daysUntil(worker.contract_end!);
    const title = "Contratto in scadenza";
    const message = `${worker.name} - ${worker.location?.name ?? "Nessun salone"}: scadenza contratto tra ${days} giorni.`;
    const scopedRecipients = recipients.filter((recipient) => recipient.role !== "RESPONSABILE" || recipient.sede_id === worker.sede_id);
    for (const recipient of scopedRecipients) {
      const existing = await prisma.notification.findFirst({
        where: { user_id: recipient.id, title, message },
      });
      if (!existing) {
        await createNotification({ user_id: recipient.id, title, message, type: "CONTRACT_EXPIRY", action_url: "/employees" });
      }
    }
  }
}
