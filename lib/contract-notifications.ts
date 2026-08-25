import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const FULL_REMINDER_DAYS = new Set([7, 3, 1, 0]);
const NOT_RENEWED_REMINDER_DAYS = new Set([1, 0]);

function daysUntil(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function history(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function reminderText(days: number) {
  if (days === 0) return "scade oggi";
  if (days === 1) return "scade domani";
  return `scade tra ${days} giorni`;
}

export async function ensureContractExpiryNotifications() {
  const workers = await prisma.user.findMany({
    where: { active: true },
    include: { location: true },
  });
  const recipients = await prisma.user.findMany({
    // Le scadenze contrattuali sono informazioni amministrative riservate.
    where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] } },
    select: { id: true },
  });

  let created = 0;
  for (const worker of workers) {
    const profile = record(worker.workforce_data);
    const renewalStatus = typeof profile.contractRenewalStatus === "string" ? profile.contractRenewalStatus : "DA_VALUTARE";
    const deadlines: Array<{ date: Date; label: string; allowedDays: Set<number> }> = [];

    if (worker.contract_end && renewalStatus !== "RINNOVATO") {
      deadlines.push({
        date: worker.contract_end,
        label: renewalStatus === "NON_RINNOVATO" ? "Contratto non rinnovato" : "Contratto",
        allowedDays: renewalStatus === "NON_RINNOVATO" ? NOT_RENEWED_REMINDER_DAYS : FULL_REMINDER_DAYS,
      });
    }

    history(worker.contract_history).forEach((item, index) => {
      const rawEnd = typeof item.endDate === "string" ? item.endDate : "";
      const status = typeof item.status === "string" ? item.status.toLowerCase() : "";
      const date = rawEnd ? new Date(`${rawEnd}T12:00:00`) : null;
      if (!date || Number.isNaN(date.getTime()) || status === "completato") return;
      deadlines.push({ date, label: `Rinnovo ${index + 1}`, allowedDays: FULL_REMINDER_DAYS });
    });

    for (const deadline of deadlines) {
      const days = daysUntil(deadline.date);
      if (!deadline.allowedDays.has(days)) continue;
      const dateKey = deadline.date.toISOString().slice(0, 10);
      const title = days === 0 ? "Scadenza contratto oggi" : "Contratto in scadenza";
      const message = `${worker.name} - ${worker.location?.name ?? "Nessun salone"}: ${deadline.label} ${reminderText(days)} (${dateKey}).`;
      for (const recipient of recipients) {
        const existing = await prisma.notification.findFirst({ where: { user_id: recipient.id, title, message } });
        if (existing) continue;
        await createNotification({
          user_id: recipient.id,
          title,
          message,
          type: "CONTRACT_EXPIRY",
          action_url: `/staff?employee=${encodeURIComponent(worker.id)}`,
        });
        created += 1;
      }
    }
  }

  return { created };
}
