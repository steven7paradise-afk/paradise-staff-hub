import { PrismaClient } from "@prisma/client";
import { cashDateFromInput, moneyNumber } from "../lib/cash-records";
import { CASH_CLOSING_FIELD_IDS } from "../lib/cash-closing-form";
import { VAULT_WITHDRAWAL_FIELD_IDS } from "../lib/vault-withdrawal-form";

const prisma = new PrismaClient();

function isCashClosingResponse(response: any) {
  const text = `${response.form?.name ?? ""} ${response.form?.category ?? ""}`.toUpperCase();
  return text.includes("CHIUSURA CASSA") || text.includes("CASSA");
}

function isVaultResponse(response: any) {
  const text = `${response.form?.name ?? ""} ${response.form?.category ?? ""}`.toUpperCase();
  return text.includes("PRELIEVO CASSAFORTE") || text.includes("CASSAFORTE") || Boolean(response.answers?._vault_withdrawal);
}

async function migrateCashClosings() {
  const responses = await prisma.serviceFormResponse.findMany({
    where: {
      form: {
        is: {
          OR: [
            { name: { contains: "chiusura cassa", mode: "insensitive" } },
            { category: { contains: "cassa", mode: "insensitive" } },
          ],
        },
      },
    },
    include: { form: true, user: true, location: true },
    orderBy: { created_at: "asc" },
  });

  let migrated = 0;
  for (const response of responses.filter(isCashClosingResponse)) {
    if (!response.user_location_id) continue;
    const answers = response.answers as any;
    const date = cashDateFromInput(answers?.[CASH_CLOSING_FIELD_IDS.date]) ?? response.created_at;
    const withdrawn = moneyNumber(answers?.[CASH_CLOSING_FIELD_IDS.withdrawn]);
    const fund = moneyNumber(answers?.[CASH_CLOSING_FIELD_IDS.fund]);
    const signature = answers?._signature ?? {};

    const existing = await prisma.cashClosing.findFirst({
      where: {
        user_id: response.user_id,
        location_id: response.user_location_id,
        created_at: response.created_at,
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.cashClosing.create({
      data: {
        user_id: response.user_id,
        location_id: response.user_location_id,
        date,
        withdrawn,
        fund,
        notes: String(answers?.[CASH_CLOSING_FIELD_IDS.notes] ?? "").trim() || null,
        signature_name: String(signature.user_name ?? response.user.name),
        signature_role: String(signature.user_role ?? response.user_role ?? response.user.role),
        signed_at: signature.signed_at ? new Date(String(signature.signed_at)) : response.created_at,
        created_at: response.created_at,
      },
    });
    migrated += 1;
  }
  return migrated;
}

async function migrateVaultWithdrawals() {
  const responses = await prisma.serviceFormResponse.findMany({
    where: {
      form: {
        is: {
          OR: [
            { name: { contains: "prelievo cassaforte", mode: "insensitive" } },
            { category: { contains: "cassaforte", mode: "insensitive" } },
          ],
        },
      },
    },
    include: { form: true, user: true, location: true },
    orderBy: { created_at: "asc" },
  });

  let migrated = 0;
  for (const response of responses.filter(isVaultResponse)) {
    if (!response.user_location_id) continue;
    const answers = response.answers as any;
    const date = cashDateFromInput(answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date]) ?? response.created_at;
    const amount = moneyNumber(answers?.[VAULT_WITHDRAWAL_FIELD_IDS.amount]);
    const reason = String(answers?.[VAULT_WITHDRAWAL_FIELD_IDS.reason] ?? "").trim();
    const signature = answers?._signature ?? {};

    const existing = await prisma.cashVaultWithdrawal.findFirst({
      where: {
        user_id: response.user_id,
        location_id: response.user_location_id,
        created_at: response.created_at,
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.cashVaultWithdrawal.create({
      data: {
        user_id: response.user_id,
        location_id: response.user_location_id,
        date,
        amount,
        reason: reason || "Motivo non indicato",
        signature_name: String(signature.user_name ?? response.user.name),
        signature_role: String(signature.user_role ?? response.user_role ?? response.user.role),
        signed_at: signature.signed_at ? new Date(String(signature.signed_at)) : response.created_at,
        created_at: response.created_at,
      },
    });
    migrated += 1;
  }
  return migrated;
}

async function migrateMonthClosings() {
  const settings = await prisma.setting.findMany({
    where: { key: { startsWith: "cash_month_close:" } },
  });
  let migrated = 0;
  for (const setting of settings) {
    const value = setting.value as any;
    const month = String(value?.month ?? setting.key.replace("cash_month_close:", ""));
    if (!/^\d{4}-\d{2}$/.test(month) || !value?.closed_by_id) continue;
    const existing = await prisma.cashMonthClose.findUnique({ where: { month }, select: { id: true } });
    if (existing) continue;
    await prisma.cashMonthClose.create({
      data: {
        month,
        closed_by_id: String(value.closed_by_id),
        closed_by_name: String(value.closed_by_name ?? "Admin"),
        closed_by_role: String(value.closed_by_role ?? "ADMIN"),
        closed_at: value.closed_at ? new Date(String(value.closed_at)) : setting.id ? new Date() : new Date(),
      },
    });
    migrated += 1;
  }
  return migrated;
}

async function main() {
  const [closings, vaults, months] = await Promise.all([
    migrateCashClosings(),
    migrateVaultWithdrawals(),
    migrateMonthClosings(),
  ]);
  console.log(`Cash migration complete: ${closings} closings, ${vaults} vault withdrawals, ${months} month closes.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
