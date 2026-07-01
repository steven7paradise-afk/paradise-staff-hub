import { prisma } from "@/lib/prisma";

export const VAULT_WITHDRAWAL_FORM_NAME = "Prelievo Cassaforte";
export const VAULT_WITHDRAWAL_FORM_CATEGORY = "Cassaforte";

export const VAULT_WITHDRAWAL_FIELD_IDS = {
  date: "vault_date",
  amount: "vault_amount",
  reason: "vault_reason",
} as const;

export async function ensureVaultWithdrawalForm(createdById?: string | null) {
  const existing = await prisma.serviceForm.findFirst({
    where: {
      OR: [
        { name: VAULT_WITHDRAWAL_FORM_NAME },
        { name: { contains: "prelievo cassaforte", mode: "insensitive" } },
      ],
    },
    orderBy: { created_at: "asc" },
  });

  if (existing) {
    return prisma.serviceForm.update({
      where: { id: existing.id },
      data: {
        category: VAULT_WITHDRAWAL_FORM_CATEGORY,
        icon: existing.icon || "CircleDollarSign",
        active: false,
        allowed_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
        notify_roles: ["SUPER_ADMIN", "ADMIN"],
      },
    });
  }

  return prisma.serviceForm.create({
    data: {
      name: VAULT_WITHDRAWAL_FORM_NAME,
      description: "Registro interno per i prelievi dalla cassaforte.",
      category: VAULT_WITHDRAWAL_FORM_CATEGORY,
      icon: "CircleDollarSign",
      active: false,
      allowed_roles: ["SUPER_ADMIN", "ADMIN", "RESPONSABILE"],
      notify_roles: ["SUPER_ADMIN", "ADMIN"],
      fields: [
        { id: VAULT_WITHDRAWAL_FIELD_IDS.date, label: "DATA PRELIEVO", type: "date", required: true },
        { id: VAULT_WITHDRAWAL_FIELD_IDS.amount, label: "IMPORTO PRELEVATO", type: "money", required: true },
        { id: VAULT_WITHDRAWAL_FIELD_IDS.reason, label: "MOTIVO PRELIEVO", type: "textarea", required: true },
      ],
      created_by_id: createdById ?? null,
    },
  });
}
