import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Coins,
  CreditCard,
  MapPin,
  PenLine,
  ReceiptText,
  ShieldCheck,
  Store,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CashActions } from "@/components/cash-actions";
import { CashHistory } from "@/components/cash-history";
import { CashReviewActions } from "@/components/cash-review-actions";
import { CashClosingAmountEditor } from "@/components/cash-closing-amount-editor";
import { CashDaySelector } from "@/components/cash-day-selector";
import { Badge, Card } from "@/components/ui";
import {
  CASH_CLOSING_FIELD_IDS,
  ensureCashClosingForm,
} from "@/lib/cash-closing-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";
import { cashDateInput } from "@/lib/cash-records";
import { VAULT_WITHDRAWAL_FIELD_IDS } from "@/lib/vault-withdrawal-form";
import { calculateClockHours } from "@/lib/work-hours";
import { getShopifyPaymentRegister, getShopifyRevenueRange } from "@/lib/shopify-payment-register";

export const dynamic = "force-dynamic";

function monthRange(monthParam?: string) {
  const parsed = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? new Date(`${monthParam}-01T00:00:00`) : new Date();
  const now = parsed;
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  return { start, end, todayStart, todayEnd, now };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date: Date) {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function romeDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getMondayDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getWeekKey(date: Date): string {
  const monday = getMondayDate(date);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateFromDayKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function moneyValue(value: unknown) {
  const amount = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value: number) {
  return value.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function answer(response: any, key: string) {
  return (response.answers as any)?.[key];
}

function cashDate(response: any) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(cashAccountingDate(response));
}

function cashAccountingDate(response: any) {
  const raw = answer(response, CASH_CLOSING_FIELD_IDS.date);
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00`);
  }
  return new Date(response.created_at);
}

function vaultAccountingDate(response: any) {
  const raw = answer(response, VAULT_WITHDRAWAL_FIELD_IDS.date);
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00`);
  }
  return new Date(response.created_at);
}

function signatureName(response: any) {
  return (response.answers as any)?._signature?.user_name || response.user?.name || "Firma non indicata";
}

function latestClosingsByLocationDay(responses: any[]) {
  const byLocationDay = new Map<string, any>();
  responses.forEach((response) => {
    const locationKey = response.user_location_id || response.user_location_name || response.id;
    const key = `${locationKey}:${dayKey(cashAccountingDate(response))}`;
    const current = byLocationDay.get(key);
    if (!current || new Date(response.created_at) > new Date(current.created_at)) {
      byLocationDay.set(key, response);
    }
  });
  return Array.from(byLocationDay.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function cashClosingRecordToResponse(record: any) {
  return {
    id: record.id,
    user_id: record.user_id,
    user_role: record.signature_role ?? record.user?.role ?? "DIPENDENTE",
    user_location_id: record.location_id,
    user_location_name: record.location?.name ?? null,
    answers: {
      [CASH_CLOSING_FIELD_IDS.date]: cashDateInput(record.date),
      [CASH_CLOSING_FIELD_IDS.withdrawn]: record.withdrawn,
      [CASH_CLOSING_FIELD_IDS.fund]: record.fund,
      [CASH_CLOSING_FIELD_IDS.notes]: record.notes ?? "",
      _signature: {
        user_id: record.user_id,
        user_name: record.signature_name,
        user_role: record.signature_role,
        signed_at: record.signed_at?.toISOString?.() ?? record.signed_at,
      },
    },
    created_at: record.created_at,
    updated_at: record.updated_at,
    user: record.user,
    location: record.location,
    review: record.review ?? null,
  };
}

function cashReview(response: any) {
  return response.review ?? { status: "DA_CONTROLLARE", note: "" };
}

function cashReviewLabel(status?: string) {
  if (status === "CORRETTO") return "Corretto";
  if (status === "ERRORE") return "Errore";
  return "Da controllare";
}

function cashReviewClass(status?: string) {
  if (status === "CORRETTO") return "bg-emerald-50 text-emerald-700";
  if (status === "ERRORE") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function vaultWithdrawalRecordToResponse(record: any) {
  return {
    id: record.id,
    user_id: record.user_id,
    user_role: record.signature_role ?? record.user?.role ?? "ADMIN",
    user_location_id: record.location_id,
    user_location_name: record.location?.name ?? null,
    answers: {
      [VAULT_WITHDRAWAL_FIELD_IDS.date]: cashDateInput(record.date),
      [VAULT_WITHDRAWAL_FIELD_IDS.amount]: record.amount,
      [VAULT_WITHDRAWAL_FIELD_IDS.reason]: record.reason,
      [VAULT_WITHDRAWAL_FIELD_IDS.receipt]: record.receipt_path
        ? {
            url: `/api/cash/vault-withdrawals/${record.id}/receipt`,
            name: record.receipt_name || "Scontrino",
          }
        : null,
      _vault_withdrawal: true,
      _signature: {
        user_id: record.user_id,
        user_name: record.signature_name,
        user_role: record.signature_role,
        signed_at: record.signed_at?.toISOString?.() ?? record.signed_at,
      },
    },
    created_at: record.created_at,
    updated_at: record.updated_at,
    user: record.user,
    location: record.location,
  };
}

export default async function CashDashboardPage(props: { searchParams: Promise<{ month?: string; day?: string; vault?: string; movements?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role as Role;
  const canEditClosingAmount = ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(role);
  const showAllVaultWithdrawals = searchParams.vault === "all";
  const movementFilter = searchParams.movements === "closings" ? "closings" : "all";

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true }
  });

  const canAccessPage = accessUser 
    ? await canAccessForUser(prisma, "/cash", accessUser)
    : role !== "DIPENDENTE";

  if (!canAccessPage) redirect("/dashboard");

  await ensureCashClosingForm(session.user.id);

  const { start, end, todayStart, todayEnd, now } = monthRange(searchParams.month);
  const isResponsible = false;
  const selectedMonth = monthKey(start);
  const prevMonth = new Date(start);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const nextMonth = new Date(start);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const trendStart = new Date(start);
  trendStart.setMonth(trendStart.getMonth() - 5);
  const requestedDay = searchParams.day ? dateFromDayKey(searchParams.day) : null;
  const todayKey = dayKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dayKey(yesterday);
  const selectedDayKey = requestedDay && requestedDay >= start && requestedDay < end
    ? searchParams.day!
    : monthKey(start) === monthKey(new Date())
      ? (yesterday >= start && yesterday < end ? yesterdayKey : todayKey)
      : dayKey(start);
  const selectedDayStart = dateFromDayKey(selectedDayKey)!;
  const selectedDayEnd = new Date(selectedDayStart);
  selectedDayEnd.setUTCDate(selectedDayEnd.getUTCDate() + 1);

  const weekKey = getWeekKey(selectedDayStart);

  const [locations, cashClosingRows, vaultWithdrawalRows, monthClose, selectedDayLogs, users, allWeekCloses, scheduleEntries, allMonthCloses] = await Promise.all([
    prisma.location.findMany({
      where: {
        active: true,
        ...(isResponsible ? { id: session.user.sedeId ?? undefined } : {}),
      },
      orderBy: { name: "asc" },
    }),
    prisma.cashClosing.findMany({
      where: {
        date: { gte: trendStart, lt: end },
        ...(isResponsible ? { location_id: session.user.sedeId ?? undefined } : {}),
      },
      include: { user: true, location: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.cashVaultWithdrawal.findMany({
      where: {
        date: { gte: trendStart, lt: end },
        ...(isResponsible ? { location_id: session.user.sedeId ?? undefined } : {}),
      },
      include: { user: true, location: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.cashMonthClose.findUnique({ where: { month: selectedMonth } }).catch(() => null),
    prisma.attendanceLog.findMany({
      where: {
        date: { gte: selectedDayStart, lt: selectedDayEnd },
        ...(isResponsible ? { location_id: session.user.sedeId ?? undefined } : {}),
        user: { role: { notIn: ["ZERO", "SUPER_ADMIN"] }, active: true },
      },
      include: { user: true, location: true, device: true },
      orderBy: [{ location: { name: "asc" } }, { timestamp: "asc" }],
    }),
    prisma.user.findMany({
      where: {
        active: true,
        role: { notIn: ["ZERO", "SUPER_ADMIN"] },
        ...(isResponsible ? { sede_id: session.user.sedeId ?? undefined } : {}),
      },
      select: { id: true, name: true, sede_id: true },
      orderBy: { name: "asc" },
    }),
    prisma.setting.findMany({
      where: { key: { startsWith: "cash_week_close:" } },
    }).catch(() => []),
    prisma.scheduleEntry.findMany({
      where: {
        date: { gte: selectedDayStart, lt: selectedDayEnd },
      },
    }),
    prisma.cashMonthClose.findMany().catch(() => []),
  ]);

  const paymentRows = await getShopifyPaymentRegister({
    start,
    end,
    locationId: isResponsible ? session.user.sedeId : null,
  });

  const closingReviewRows = cashClosingRows.length
    ? await prisma.setting.findMany({
        where: {
          key: { in: cashClosingRows.map((record) => `cash_closing_review:${record.id}`) },
        },
      })
    : [];
  const reviewMap = new Map(
    closingReviewRows.map((setting) => [setting.key.replace("cash_closing_review:", ""), setting.value])
  );
  const closingRecords = cashClosingRows
    .map((record) => ({ ...record, review: reviewMap.get(record.id) ?? { status: "DA_CONTROLLARE", note: "" } }))
    .map(cashClosingRecordToResponse);
  const vaultWithdrawalRecords = vaultWithdrawalRows.map(vaultWithdrawalRecordToResponse);
  const trendClosingRecords = closingRecords;
  const trendVaultWithdrawalRecords = vaultWithdrawalRecords;

  const vaultWithdrawals = vaultWithdrawalRecords.filter((response) => {
    const accountingDate = vaultAccountingDate(response);
    return accountingDate >= start && accountingDate < end;
  });
  const visibleVaultWithdrawals = showAllVaultWithdrawals ? vaultWithdrawals : vaultWithdrawals.slice(0, 3);
  const vaultToggleHref = `/cash?month=${selectedMonth}${searchParams.day ? `&day=${encodeURIComponent(searchParams.day)}` : ""}${showAllVaultWithdrawals ? "" : "&vault=all"}#prelievi-autorizzati`;

  const responses = latestClosingsByLocationDay(closingRecords.filter((response) => {
    const accountingDate = cashAccountingDate(response);
    return accountingDate >= start && accountingDate < end;
  }));

  // Compare Shopify against exactly the period covered by the declared cash
  // closings. The previous month-end query also included sales made after the
  // latest closing, creating a false discrepancy during the current month.
  const latestDeclaredDay = responses.reduce<Date | null>((latest, response) => {
    const date = cashAccountingDate(response);
    return !latest || date > latest ? date : latest;
  }, null);
  const shopifyComparisonEnd = latestDeclaredDay ? new Date(latestDeclaredDay) : new Date(start);
  shopifyComparisonEnd.setDate(shopifyComparisonEnd.getDate() + (latestDeclaredDay ? 1 : 0));
  const shopifyRevenue = await getShopifyRevenueRange(dayKey(start), dayKey(shopifyComparisonEnd));

  const trendClosings = latestClosingsByLocationDay(trendClosingRecords.filter((response) => {
    const accountingDate = cashAccountingDate(response);
    return accountingDate >= trendStart && accountingDate < end;
  }));

  const trendVaultWithdrawals = trendVaultWithdrawalRecords.filter((response) => {
    const accountingDate = vaultAccountingDate(response);
    return accountingDate >= trendStart && accountingDate < end;
  });

  const todayResponses = responses.filter((response) => {
    const accountingDate = cashAccountingDate(response);
    return accountingDate >= todayStart && accountingDate < todayEnd;
  });

  const totalWithdrawn = responses.reduce((sum, response) => sum + moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn)), 0);
  const totalVaultOut = vaultWithdrawals.reduce((sum, response) => sum + moneyValue(answer(response, VAULT_WITHDRAWAL_FIELD_IDS.amount)), 0);
  // Derive the accounting total only from the Shopify transaction rows.
  // Vault movements, cash funds and manual cash records never enter here.
  const shopifyCashExpected = shopifyRevenue.payments.reduce(
    (sum, payment) =>
      payment.method === "CONTANTI" || payment.method === "CASHMATIC"
        ? sum + payment.amount
        : sum,
    0,
  );
  const shopifyCashDifference = totalWithdrawn - shopifyCashExpected;
  const shopifyCashByDay = new Map<string, number>();
  for (const payment of shopifyRevenue.payments) {
    if (payment.method !== "CONTANTI" && payment.method !== "CASHMATIC") continue;
    const key = romeDayKey(new Date(payment.processedAt));
    shopifyCashByDay.set(key, (shopifyCashByDay.get(key) ?? 0) + payment.amount);
  }
  const declaredCashByDay = new Map<string, number>();
  for (const response of responses) {
    const key = dayKey(cashAccountingDate(response));
    declaredCashByDay.set(
      key,
      (declaredCashByDay.get(key) ?? 0) + moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn)),
    );
  }

  const weekClosesList = Array.isArray(allWeekCloses) ? allWeekCloses : [];

  // Calcolo cumulativo all-time (fino alla data 'end' del mese selezionato, azzerando all'ultimo mese chiuso)
  const allClosedMonths = Array.isArray(allMonthCloses) ? allMonthCloses : [];
  const sortedClosedMonths = [...allClosedMonths].sort((a, b) => b.month.localeCompare(a.month));
  const latestClosedMonth = sortedClosedMonths[0]?.month || null; // es. "2026-06"
  
  let openPeriodStart: Date | null = null;
  if (latestClosedMonth) {
    const parts = latestClosedMonth.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    // Primo giorno del mese successivo a quello chiuso (es. 1 Luglio 2026)
    openPeriodStart = new Date(year, month, 1, 0, 0, 0);
  }

  const allTimeWeekCloses = weekClosesList.filter((setting) => {
    const value = setting.value as any;
    if (!value?.weekKey) return false;
    const parts = value.weekKey.split(":");
    const endStr = parts[1] || parts[0];
    let endDate: Date;
    if (parts.length === 1) {
      const mondayDate = new Date(endStr + "T00:00:00");
      endDate = new Date(mondayDate);
      endDate.setDate(endDate.getDate() + 6);
    } else {
      endDate = new Date(endStr + "T00:00:00");
    }
    const keyParts = setting.key.split(":");
    const settingLocationId = keyParts[1];
    if (isResponsible && settingLocationId !== session.user.sedeId) {
      return false;
    }
    if (openPeriodStart && endDate < openPeriodStart) {
      return false;
    }
    return endDate < end;
  });

  const allTimeResponses = latestClosingsByLocationDay(closingRecords.filter((response) => {
    const accountingDate = cashAccountingDate(response);
    if (accountingDate >= end) return false;
    
    if (openPeriodStart) {
      if (accountingDate >= openPeriodStart) return true;
      const inActiveWeek = allTimeWeekCloses.some((setting) => {
        const value = setting.value as any;
        if (!value?.weekKey) return false;
        const parts = value.weekKey.split(":");
        const startRange = new Date(parts[0] + "T00:00:00");
        let endRange: Date;
        if (parts.length === 1) {
          endRange = new Date(startRange);
          endRange.setDate(endRange.getDate() + 7);
        } else {
          endRange = new Date(parts[1] + "T23:59:59");
        }
        return accountingDate >= startRange && accountingDate <= endRange;
      });
      return inActiveWeek;
    }
    return true;
  }));

  const allTimeVaultWithdrawals = vaultWithdrawalRecords.filter((response) => {
    const accountingDate = vaultAccountingDate(response);
    if (accountingDate >= end) return false;
    
    if (openPeriodStart) {
      if (accountingDate >= openPeriodStart) return true;
      const inActiveWeek = allTimeWeekCloses.some((setting) => {
        const value = setting.value as any;
        if (!value?.weekKey) return false;
        const parts = value.weekKey.split(":");
        const startRange = new Date(parts[0] + "T00:00:00");
        let endRange: Date;
        if (parts.length === 1) {
          endRange = new Date(startRange);
          endRange.setDate(endRange.getDate() + 7);
        } else {
          endRange = new Date(parts[1] + "T23:59:59");
        }
        return accountingDate >= startRange && accountingDate <= endRange;
      });
      return inActiveWeek;
    }
    return true;
  });

  const totalWithdrawnCumulative = allTimeResponses.reduce((sum, response) => sum + moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn)), 0);
  const totalVaultOutCumulative = allTimeVaultWithdrawals.reduce((sum, response) => sum + moneyValue(answer(response, VAULT_WITHDRAWAL_FIELD_IDS.amount)), 0);

  const totalBankDepositsCumulative = allTimeWeekCloses.reduce((sum, setting) => {
    const value = setting.value as any;
    const deposit = Number(value?.bank_deposit || 0);
    return sum + (isNaN(deposit) ? 0 : deposit);
  }, 0);

  const totalWeeklyWithdrawalsCumulative = allTimeWeekCloses.reduce((sum, setting) => {
    const value = setting.value as any;
    const withdrawals = Number(value?.withdrawals || 0);
    return sum + (isNaN(withdrawals) ? 0 : withdrawals);
  }, 0);

  const totalClosedVaultOutCumulative = allTimeVaultWithdrawals.reduce((sum, vw: any) => {
    const locId = vw.user_location_id;
    const rawDate = vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.date] || vw.date;
    const vwDate = rawDate ? new Date(rawDate + "T00:00:00") : new Date(vw.created_at);
    
    const isClosed = allTimeWeekCloses.some((setting) => {
      const value = setting.value as any;
      if (!value?.weekKey) return false;
      const keyParts = setting.key.split(":");
      const settingLocationId = keyParts[1];
      if (settingLocationId !== locId) return false;
      
      const parts = value.weekKey.split(":");
      const startRange = new Date(parts[0] + "T00:00:00");
      let endRange: Date;
      if (parts.length === 1) {
        endRange = new Date(startRange);
        endRange.setDate(endRange.getDate() + 7);
      } else {
        endRange = new Date(parts[1] + "T23:59:59");
      }
      
      return vwDate >= startRange && vwDate <= endRange;
    });
    
    if (isClosed) {
      return sum + moneyValue(vw.answers?.[VAULT_WITHDRAWAL_FIELD_IDS.amount] || vw.amount || 0);
    }
    return sum;
  }, 0);

  const netCash = totalWithdrawnCumulative - totalVaultOutCumulative - totalBankDepositsCumulative - totalWeeklyWithdrawalsCumulative + totalClosedVaultOutCumulative;
  
  // Filtra le chiusure settimanali che ricadono nel mese corrente (usando la domenica di fine settimana)
  const monthWeekCloses = weekClosesList.filter((setting) => {
    const value = setting.value as any;
    if (!value?.weekKey) return false;
    const parts = value.weekKey.split(":");
    const endStr = parts[1] || parts[0];
    let endDate: Date;
    if (parts.length === 1) {
      const mondayDate = new Date(endStr + "T00:00:00");
      endDate = new Date(mondayDate);
      endDate.setDate(endDate.getDate() + 6);
    } else {
      endDate = new Date(endStr + "T00:00:00");
    }
    const keyParts = setting.key.split(":");
    const settingLocationId = keyParts[1];
    if (isResponsible && settingLocationId !== session.user.sedeId) {
      return false;
    }
    return endDate >= start && endDate < end;
  });

  const totalBankDeposits = monthWeekCloses.reduce((sum, setting) => {
    const value = setting.value as any;
    const deposit = Number(value?.bank_deposit || 0);
    return sum + (isNaN(deposit) ? 0 : deposit);
  }, 0);

  const totalWeeklyWithdrawals = monthWeekCloses.reduce((sum, setting) => {
    const value = setting.value as any;
    const withdrawals = Number(value?.withdrawals || 0);
    return sum + (isNaN(withdrawals) ? 0 : withdrawals);
  }, 0);
  const todayWithdrawn = todayResponses.reduce((sum, response) => sum + moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn)), 0);
  const discrepancyResponses = responses.filter((response) => Math.abs(moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.fund)) - 50) > 0.009);
  const signedCount = responses.filter((response) => (response.answers as any)?._signature?.signed_at).length;
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(now);
  const monthCloseValue = monthClose
    ? {
        month: monthClose.month,
        closed_at: monthClose.closed_at.toISOString(),
        closed_by_id: monthClose.closed_by_id,
        closed_by_name: monthClose.closed_by_name,
        closed_by_role: monthClose.closed_by_role,
      }
    : null;

  const currentWeekCloses = weekClosesList.filter((s) => s.key.endsWith(`:${weekKey}`));
  const weekCloseValue = isResponsible
    ? (weekClosesList.find((s) => s.key === `cash_week_close:${session.user.sedeId}:${weekKey}`)?.value as any || null)
    : (currentWeekCloses.length === locations.length && locations.length > 0
        ? (currentWeekCloses[0]?.value as any)
        : null);
  const monthDays = Array.from({ length: Math.round((end.getTime() - start.getTime()) / 86_400_000) }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const key = dayKey(date);
    const closingTotal = responses
      .filter((response) => dayKey(cashAccountingDate(response)) === key)
      .reduce((sum, response) => sum + moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn)), 0);
    const vaultTotal = vaultWithdrawals
      .filter((response) => dayKey(vaultAccountingDate(response)) === key)
      .reduce((sum, response) => sum + moneyValue(answer(response, VAULT_WITHDRAWAL_FIELD_IDS.amount)), 0);
    return { key, date, closingTotal, vaultTotal };
  });
  const selectedDayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(selectedDayStart);
  const selectedDayClosings = responses.filter((response) => dayKey(cashAccountingDate(response)) === selectedDayKey);
  const selectedDayVaults = vaultWithdrawals.filter((response) => dayKey(vaultAccountingDate(response)) === selectedDayKey);
  const selectedDayWithdrawn = selectedDayClosings.reduce((sum, response) => sum + moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn)), 0);
  const schedLocationMap = new Map(scheduleEntries.map((s) => [s.user_id, s.location_id]));

  const workersForClosing = (response: any) => {
    const closingTime = new Date(response.created_at);
    const targetLocationId = response.user_location_id || response.location_id;

    // Filter logs for users that belong to this closing's location today (either scheduled or primary)
    const filteredLogs = selectedDayLogs.filter((log) => {
      const userLoc = schedLocationMap.get(log.user_id) || log.user.sede_id || null;
      return userLoc === targetLocationId;
    });

    const groups = new Map<string, typeof selectedDayLogs>();
    filteredLogs.forEach((log) => {
      groups.set(log.user_id, [...(groups.get(log.user_id) ?? []), log]);
    });

    return Array.from(groups.entries()).flatMap(([userId, logs]) => {
      const ordered = [...logs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const latestBeforeClosing = ordered.filter((log) => log.timestamp <= closingTime).at(-1);
      if (!latestBeforeClosing) return [];

      if (latestBeforeClosing.type === "USCITA") {
        const diffMs = closingTime.getTime() - latestBeforeClosing.timestamp.getTime();
        const oneHour = 60 * 60 * 1000;
        if (diffMs > oneHour) {
          return [];
        }
      }

      const clock = calculateClockHours(ordered.map((log) => ({ type: log.type, timestamp: log.timestamp })));
      return [{
        userId,
        name: latestBeforeClosing.user.name,
        photoUrl: latestBeforeClosing.user.photo_url || null,
        status: latestBeforeClosing.type === "PAUSA" ? "In pausa" : (latestBeforeClosing.type === "USCITA" ? "Uscito" : "In turno"),
        latestTime: latestBeforeClosing.time,
        logs: ordered,
        clock,
      }];
    });
  };
  const trendMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(start);
    date.setMonth(date.getMonth() - (5 - index));
    const key = monthKey(date);
    const closeTotal = trendClosings
      .filter((response) => monthKey(cashAccountingDate(response)) === key)
      .reduce((sum, response) => sum + moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn)), 0);
    const vaultTotal = trendVaultWithdrawals
      .filter((response) => monthKey(vaultAccountingDate(response)) === key)
      .reduce((sum, response) => sum + moneyValue(answer(response, VAULT_WITHDRAWAL_FIELD_IDS.amount)), 0);
    return { key, label: new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date), closeTotal, vaultTotal, net: closeTotal - vaultTotal };
  });

  const storeRows = locations.map((location) => {
    const storeResponses = responses.filter((response) => response.user_location_id === location.id);
    const storeToday = todayResponses.filter((response) => response.user_location_id === location.id);
    const storeTotal = storeResponses.reduce((sum, response) => sum + moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn)), 0);
    const storeVaultWithdrawals = vaultWithdrawals.filter((response) => response.user_location_id === location.id);
    const storeVaultTotal = storeVaultWithdrawals.reduce((sum, response) => sum + moneyValue(answer(response, VAULT_WITHDRAWAL_FIELD_IDS.amount)), 0);
    const storeDiscrepancies = storeResponses.filter((response) => Math.abs(moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.fund)) - 50) > 0.009);
    const lastClosing = storeResponses[0] ?? null;
    return {
      location,
      responses: storeResponses,
      today: storeToday,
      total: storeTotal,
      vaultTotal: storeVaultTotal,
      net: storeTotal - storeVaultTotal,
      discrepancies: storeDiscrepancies,
      lastClosing,
    };
  });

  const orphanResponses = responses.filter((response) => !response.user_location_id);
  const missingTodayCount = storeRows.filter((row) => row.today.length === 0).length;
  const pendingReviewCount = responses.filter((response) => cashReview(response).status === "DA_CONTROLLARE").length;
  const maxTrend = Math.max(...trendMonths.map((month) => Math.abs(month.net)), 1);
  const monthlyMovements = [
    ...responses.map((response) => ({
      id: `closing-${response.id}`,
      kind: "Chiusura cassa",
      date: cashAccountingDate(response),
      locationName: response.user_location_name || response.location?.name || "Sede non indicata",
      operator: signatureName(response),
      amount: moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn)),
      amountClass: "text-emerald-700",
      detail: `Fondo cassa ${formatMoney(moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.fund)))}`,
      expectedShopifyCash: shopifyCashByDay.get(dayKey(cashAccountingDate(response))) ?? 0,
      declaredCashForDay: declaredCashByDay.get(dayKey(cashAccountingDate(response))) ?? 0,
      note: String(answer(response, CASH_CLOSING_FIELD_IDS.notes) || "-"),
      closing: response,
      vault: null as any,
    })),
    ...vaultWithdrawals.map((response) => ({
      id: `vault-${response.id}`,
      kind: "Prelievo cassaforte",
      date: vaultAccountingDate(response),
      locationName: response.user_location_name || response.location?.name || "Sede non indicata",
      operator: signatureName(response),
      amount: -moneyValue(answer(response, VAULT_WITHDRAWAL_FIELD_IDS.amount)),
      amountClass: "text-[#A74758]",
      detail: String(answer(response, VAULT_WITHDRAWAL_FIELD_IDS.reason) || "Motivo non indicato"),
      expectedShopifyCash: null,
      declaredCashForDay: null,
      note: String(answer(response, VAULT_WITHDRAWAL_FIELD_IDS.reason) || "-"),
      closing: null as any,
      vault: response,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  const visibleMonthlyMovements = movementFilter === "closings"
    ? monthlyMovements.filter((movement) => Boolean(movement.closing))
    : monthlyMovements;

  const cashQueryBase = `month=${selectedMonth}`;
  const availabilityHref = `/cash?${cashQueryBase}#chiusure-sedi`;
  const selectedDayHref = `/cash?${cashQueryBase}&day=${selectedDayKey}#dettaglio-giorno`;
  const vaultOutHref = `/cash?${cashQueryBase}&vault=all#prelievi-autorizzati`;
  const monthlyClosingsHref = `/cash?${cashQueryBase}&movements=closings#movimenti-cassa`;

  return (
    <AppShell
      title="Cash Dashboard"
      subtitle="Ingresso cash, chiusure cassa mensili, firme e controllo per sede."
      role={role}
      hideHeader
    >
      <div className="space-y-5">
        <section className="-mx-4 overflow-hidden border-y border-black/10 bg-white sm:mx-0 sm:rounded-lg sm:border">
          <div className="grid gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-7">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#A74758]">
                <CircleDollarSign className="size-4" />
                Controllo cassa
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#111017] sm:text-4xl">Cassa e chiusure</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
                Controlla il giorno, individua le sedi mancanti e gestisci il mese senza mescolare i pagamenti Shopify.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="inline-flex h-11 items-center rounded-md border border-black/10 bg-[#FAF7F9] p-1">
                <Link href={`/cash?month=${monthKey(prevMonth)}`} aria-label="Mese precedente" className="grid size-9 place-items-center rounded text-black/55 hover:bg-white hover:text-black">
                  <ChevronLeft className="size-4" />
                </Link>
                <span className="min-w-32 px-3 text-center text-xs font-black capitalize text-black">{monthLabel}</span>
                <Link href={`/cash?month=${monthKey(nextMonth)}`} aria-label="Mese successivo" className="grid size-9 place-items-center rounded text-black/55 hover:bg-white hover:text-black">
                  <ChevronRight className="size-4" />
                </Link>
              </div>
              <CashDaySelector selectedDay={selectedDayKey} month={selectedMonth} />
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-black/10 lg:grid-cols-4">
            <MetricCard href={availabilityHref} label="Disponibilità saloni" value={formatMoney(netCash)} note="Vedi origine e chiusure" icon={CircleDollarSign} tone="gold" />
            <MetricCard href={selectedDayHref} label={`Chiusure ${selectedDayStart.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}`} value={formatMoney(selectedDayWithdrawn)} note="Apri le transazioni del giorno" icon={ReceiptText} tone="blue" />
            <MetricCard href={vaultOutHref} label="Uscito cassaforte" value={formatMoney(totalVaultOut)} note="Vedi tutte le uscite" icon={Calculator} tone="pink" />
            <MetricCard href={monthlyClosingsHref} label="Prelevato nel mese" value={formatMoney(totalWithdrawn)} note="Vedi le chiusure del mese" icon={ShieldCheck} tone="green" />
          </div>

          <div className="grid border-t border-black/10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="grid grid-cols-2 divide-x divide-black/10 lg:flex lg:divide-x-0">
              <a href="#chiusure-sedi" className="flex min-h-16 items-center gap-3 px-5 py-3 hover:bg-[#FAF7F9]">
                <span className={`grid size-9 place-items-center rounded-md ${missingTodayCount ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {missingTodayCount ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                </span>
                <span><strong className="block text-lg leading-none">{missingTodayCount}</strong><small className="text-[11px] font-bold text-black/45">sedi mancanti oggi</small></span>
              </a>
              <a href="#movimenti-cassa" className="flex min-h-16 items-center gap-3 px-5 py-3 hover:bg-[#FAF7F9]">
                <span className={`grid size-9 place-items-center rounded-md ${pendingReviewCount ? "bg-pink-50 text-[#A74758]" : "bg-emerald-50 text-emerald-700"}`}>
                  <ShieldCheck className="size-4" />
                </span>
                <span><strong className="block text-lg leading-none">{pendingReviewCount}</strong><small className="text-[11px] font-bold text-black/45">controlli aperti</small></span>
              </a>
            </div>
            <div className="border-t border-black/10 p-4 lg:border-l lg:border-t-0">
              <CashActions
              month={selectedMonth}
              monthClosed={monthCloseValue}
              weekKey={weekKey}
              weekClosed={isResponsible ? (weekCloseValue ? [weekCloseValue] : []) : currentWeekCloses.map(c => c.value)}
              locations={locations.map((location) => ({ id: location.id, name: location.name }))}
              users={users.map((user) => ({ id: user.id, name: user.name, locationId: user.sede_id }))}
              allClosings={closingRecords}
              vaultWithdrawals={vaultWithdrawalRecords}
              monthWeekCloses={monthWeekCloses.map((setting) => ({ key: setting.key, value: setting.value }))}
              isResponsible={isResponsible}
              userSedeId={session.user.sedeId ?? null}
              />
            </div>
          </div>
        </section>

        <Card className="-mx-4 overflow-hidden rounded-none border-y border-black/10 bg-white p-0 shadow-none sm:mx-0 sm:rounded-lg sm:border">
          <div className="flex flex-col gap-3 border-b border-black/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A74758]">Registro separato Shopify</p>
              <h2 className="mt-1 text-2xl font-black">Pagamenti rilevati</h2>
              <p className="mt-1 text-sm text-black/45">Registrazione automatica dal 2° ordine finale. Questi importi non modificano i totali della cassa.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-md bg-[#F2FBF6] px-3 py-2.5 text-xs font-black text-emerald-700">
                <ShieldCheck className="size-4 text-[#F7DFA7]" />
                Non incluso nei calcoli
              </div>
              <Link
                href={`/cash/shopify-payments?month=${selectedMonth}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#111017] px-4 py-3 text-xs font-black text-white transition hover:bg-black"
              >
                Vedi registro completo
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          <div className="p-5">
            {paymentRows.length ? (
              <div className="divide-y divide-black/5 overflow-hidden rounded-md border border-black/10">
                {paymentRows.slice(0, 4).map((payment) => {
                  const isCashmatic = payment.method === "CASHMATIC";
                  const isCash = payment.method === "CONTANTI";
                  const isVerified = payment.verified && payment.method !== "DA_VERIFICARE";
                  const PaymentIcon = isCashmatic ? Banknote : isCash ? Coins : CreditCard;
                  return (
                    <div key={payment.id} className="grid gap-3 bg-white p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                      <div className={`flex size-11 items-center justify-center rounded-xl ${isVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        <PaymentIcon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-black">{payment.clientName}</p>
                          <span className="rounded-full bg-black/5 px-2 py-1 text-[10px] font-black uppercase text-black/50">
                            Ordine {payment.order ? `#${payment.order}` : "mancante"}
                          </span>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${isVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {isVerified ? "Verificato" : "Da verificare"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-black/40">
                          {new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(payment.createdAt)}
                          {payment.locationName ? ` · ${payment.locationName}` : ""}
                          {payment.gateway ? ` · Gateway ${payment.gateway}` : ""}
                        </p>
                        {payment.reference ? <p className="mt-1 truncate text-[10px] font-semibold text-black/30">Rif. {payment.reference}</p> : null}
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                        <p className="text-base font-black">{formatMoney(payment.amount)}</p>
                        <p className={`mt-1 text-[10px] font-black uppercase ${isVerified ? "text-emerald-700" : "text-amber-700"}`}>
                          {isCashmatic ? "Cashmatic" : isCash ? "Contanti" : payment.method === "CARTA" ? "Carta" : "Metodo da verificare"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 bg-[#FAF7F9] px-5 py-8 text-center">
                <ReceiptText className="mx-auto size-5 text-black/25" />
                <p className="mt-2 text-sm font-bold text-black/45">Nessun pagamento Shopify registrato nel periodo.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="-mx-4 rounded-none border-y border-black/10 bg-white p-5 shadow-none sm:mx-0 sm:rounded-lg sm:border">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Andamento mesi precedenti</p>
              <h2 className="mt-1 text-2xl font-black">Cash netto mensile</h2>
            </div>
          </div>
          <div className="grid gap-2 sm:gap-3 grid-cols-3 md:grid-cols-6">
            {trendMonths.map((month) => (
              <div key={month.key} className="rounded-md border border-black/10 bg-[#FAF7F9] p-3">
                <p className="text-[10px] font-black uppercase text-black/35">{month.label}</p>
                <p className="mt-2 text-base sm:text-lg font-black">{formatMoney(month.net)}</p>
                <div className="mt-1 text-[9px] sm:text-[11px] font-bold text-black/45 flex flex-col sm:flex-row sm:gap-1.5 leading-tight">
                  <div>In {formatMoney(month.closeTotal)}</div>
                  <div className="hidden sm:block">·</div>
                  <div>Out {formatMoney(month.vaultTotal)}</div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden bg-black/5">
                  <div
                    className="h-full bg-[#A74758]"
                    style={{ width: `${Math.max(8, Math.min(100, (Math.abs(month.net) / maxTrend) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <CashHistory
          weekCloses={monthWeekCloses}
          locations={locations.map((loc) => ({ id: loc.id, name: loc.name }))}
          isResponsible={isResponsible}
          userSedeId={session.user.sedeId ?? null}
        />

        <Card id="dettaglio-giorno" className="-mx-4 scroll-mt-6 overflow-hidden rounded-none border-y border-black/10 bg-white p-0 shadow-none sm:mx-0 sm:rounded-lg sm:border">
          <div className="border-b border-black/5 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A74758]">Dettaglio giorno</p>
            <h2 className="mt-1 text-2xl font-black capitalize">Clicca una data e controlla chiusura + timbrature</h2>
            <p className="mt-1 text-sm text-black/45">Ogni giorno mostra chi ha chiuso la cassa e chi ha lavorato secondo le timbrature tablet.</p>
          </div>
          <div className="border-b border-black/5 p-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {monthDays.map((day) => {
                const active = day.key === selectedDayKey;
                return (
                  <Link
                    key={day.key}
                    href={`/cash?month=${selectedMonth}&day=${day.key}`}
                    className={`min-w-[82px] rounded-md border p-3 text-center transition ${active ? "border-[#A74758] bg-[#A74758] text-white" : "border-black/10 bg-[#FAF7F9] text-black hover:border-[#A74758]/30"}`}
                  >
                    <p className="text-[10px] font-black uppercase opacity-60">
                      {new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(day.date)}
                    </p>
                    <p className="mt-1 text-xl font-black">{day.date.getDate()}</p>
                    {(day.closingTotal > 0 || day.vaultTotal > 0) ? (
                      <p className="mt-1 text-[10px] font-black opacity-75">{formatMoney(day.closingTotal - day.vaultTotal)}</p>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
          {searchParams.day ? (
            <div className="p-5">
              <div className="rounded-3xl border border-black/5 bg-[#FAF7F9] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">Giorno selezionato</p>
                <h3 className="mt-1 text-xl font-black capitalize">{selectedDayLabel}</h3>
                <div className="mt-4 grid gap-2 grid-cols-3">
                  <StoreValue label="Chiusure" value={String(selectedDayClosings.length)} />
                  <StoreValue label="Cash" value={formatMoney(selectedDayClosings.reduce((sum, response) => sum + moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn)), 0))} />
                  <StoreValue label="Cassaforte" value={formatMoney(selectedDayVaults.reduce((sum, response) => sum + moneyValue(answer(response, VAULT_WITHDRAWAL_FIELD_IDS.amount)), 0))} />
                </div>
                <div className="mt-4 space-y-3">
                  {selectedDayClosings.map((response) => {
                    const staffAtClosing = workersForClosing(response);
                    return (
                      <div key={response.id} className="rounded-[28px] bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/35">Chiusura cassa</p>
                            <p className="mt-1 text-lg font-black">{response.user_location_name || response.location?.name || "Sede non indicata"}</p>
                            <p className="mt-1 text-xs font-semibold text-black/45">
                              Fatta da {signatureName(response)} alle {new Date(response.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[#FAF7F9] px-4 py-3 text-right">
                            <p className="text-[10px] font-black uppercase text-black/35">Prelevato</p>
                            <CashClosingAmountEditor closingId={response.id} currentAmount={moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn))} canEdit={canEditClosingAmount} />
                          </div>
                        </div>

                        <div className="mt-4 rounded-3xl border border-black/5 bg-[#111017] p-4 text-white">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#F7DFA7]">Presenti nel salone al momento della chiusura</p>
                          <p className="mt-1 text-sm text-white/45">Mostra solo chi aveva timbrato nello stesso salone e non risultava uscito prima della chiusura.</p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            {staffAtClosing.map((worker) => {
                              const tooltipContent = `${worker.name} (${worker.status})\n• Prima entrata: ${worker.clock.firstEntry || "-"}\n• Ultima uscita: ${worker.clock.lastExit || "-"}\n• Ore nette: ${worker.clock.netHours}h\n• Timbrature:\n${worker.logs.map(log => `  - ${log.type}: ${log.time}`).join("\n")}`;

                              return (
                                <div
                                  key={worker.userId}
                                  title={tooltipContent}
                                  className="group relative cursor-pointer"
                                >
                                  {worker.photoUrl ? (
                                    <img
                                      src={worker.photoUrl}
                                      alt={worker.name}
                                      className="size-12 rounded-full object-cover border-2 border-white/20 transition hover:border-[#F39BD1] hover:scale-105"
                                    />
                                  ) : (
                                    <div className="size-12 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center font-black text-white hover:border-[#F39BD1] hover:scale-105 transition text-xs">
                                      {worker.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                    </div>
                                  )}
                                  
                                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-2xl bg-black/95 p-3 text-xs leading-5 text-white opacity-0 shadow-xl transition-all duration-200 group-hover:opacity-100 border border-white/10 scale-95 group-hover:scale-100">
                                    <p className="font-black text-[#F39BD1]">{worker.name}</p>
                                    <p className="mt-1 text-[10px] font-semibold text-white/50">{worker.status} · ultima timbratura {worker.latestTime}</p>
                                    <div className="mt-2 grid grid-cols-2 gap-1 border-t border-white/10 pt-2 text-[10px] text-white/80">
                                      <p>Entrata: <strong>{worker.clock.firstEntry || "-"}</strong></p>
                                      <p>Uscita: <strong>{worker.clock.lastExit || "-"}</strong></p>
                                      <p className="col-span-2">Ore nette: <strong>{worker.clock.netHours}h</strong></p>
                                    </div>
                                    <div className="mt-2 max-h-24 overflow-y-auto border-t border-white/10 pt-2 text-[10px] space-y-0.5 text-white/60">
                                      {worker.logs.map((log) => (
                                        <p key={log.id}>• {log.type}: {log.time}</p>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {staffAtClosing.length === 0 ? (
                              <p className="rounded-2xl border border-dashed border-white/15 p-3 text-xs text-white/45">Nessuna persona risultava in turno in questo salone all'orario della chiusura.</p>
                            ) : null}
                          </div>
                        </div>

                        {answer(response, CASH_CLOSING_FIELD_IDS.notes) ? (
                          <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-[#FAF7F9] p-3 text-xs leading-5 text-black/55">{String(answer(response, CASH_CLOSING_FIELD_IDS.notes))}</p>
                        ) : null}
                        <div className="mt-3">
                          <CashReviewActions closingId={response.id} initialReview={cashReview(response)} />
                        </div>
                      </div>
                    );
                  })}
                  {selectedDayClosings.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm font-semibold text-black/40">Nessuna chiusura cassa in questa data.</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <Card className="bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Periodo</p>
            <p className="mt-2 text-2xl font-black capitalize">{monthLabel}</p>
            <p className="mt-1 text-xs text-black/45">Accumulo mensile per data invio chiusura.</p>
          </Card>
          <Card className="bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Negozi</p>
            <p className="mt-2 text-2xl font-black">{locations.length}</p>
            <p className="mt-1 text-xs text-black/45">Sedi attive incluse nel controllo.</p>
          </Card>
          <Card className="bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Discrepanze fondo</p>
            <p className="mt-2 text-2xl font-black text-[#A74758]">{discrepancyResponses.length}</p>
            <p className="mt-1 text-xs text-black/45">Fondo cassa diverso da € 50,00.</p>
          </Card>
          <Card className="bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Mancano oggi</p>
            <p className="mt-2 text-2xl font-black">{storeRows.filter((row) => row.today.length === 0).length}</p>
            <p className="mt-1 text-xs text-black/45">Sedi senza chiusura registrata oggi.</p>
          </Card>
        </div>

        <section id="chiusure-sedi" className="grid scroll-mt-6 gap-4 xl:grid-cols-[1fr_380px]">
          <Card className="-mx-4 overflow-hidden rounded-none border-y border-black/10 bg-white p-0 shadow-none sm:mx-0 sm:rounded-lg sm:border">
            <div className="border-b border-black/5 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A74758]">Origine della disponibilità</p>
              <h2 className="mt-1 text-2xl font-black">Da dove provengono i soldi disponibili</h2>
              <p className="mt-1 text-sm leading-6 text-black/45">Apri ogni sede per controllare giorni, importi e operatori delle singole chiusure.</p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <StoreValue label="Chiusure accumulate" value={formatMoney(totalWithdrawnCumulative)} />
                <StoreValue label="Uscite cassaforte aperte" value={`− ${formatMoney(totalVaultOutCumulative - totalClosedVaultOutCumulative)}`} />
                <StoreValue label="Versamenti banca" value={`− ${formatMoney(totalBankDepositsCumulative)}`} />
                <StoreValue label="Altre uscite chiuse" value={`− ${formatMoney(totalWeeklyWithdrawalsCumulative)}`} />
                <div className="flex flex-col justify-between rounded-md border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-[10px] font-black uppercase leading-none tracking-wider text-emerald-700">Disponibile adesso</p>
                  <p className="mt-2 text-base font-black leading-none text-emerald-900">{formatMoney(netCash)}</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-black/5">
              {storeRows.map((row) => (
                <div key={row.location.id} className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 lg:max-w-md">
                    <div className="flex items-center gap-3">
                      <div className="grid size-11 shrink-0 place-items-center rounded-md bg-[#F7E9EF] text-[#A74758]">
                        <Store className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black text-[#171717]">{row.location.name}</h3>
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-black/45">
                          <MapPin className="size-3.5" />
                          {row.location.address || "Indirizzo non impostato"}
                        </p>
                      </div>
                    </div>
                    {row.lastClosing ? (
                      <p className="mt-3 text-xs text-black/48">
                        Ultima firma: <strong>{signatureName(row.lastClosing)}</strong> · {new Date(row.lastClosing.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    ) : (
                      <p className="mt-3 text-xs font-semibold text-black/35">Nessuna chiusura nel mese.</p>
                    )}
                    {row.responses.length ? (
                      <details className="group mt-3 rounded-2xl border border-black/5 bg-[#FAF7F9] p-3">
                        <summary className="cursor-pointer list-none text-xs font-black text-[#A74758] marker:hidden">
                          Vedi giorni e chiusure ({row.responses.length})
                        </summary>
                        <div className="mt-3 divide-y divide-black/5 border-t border-black/5">
                          {row.responses.map((closing) => (
                            <div key={closing.id} className="flex items-center justify-between gap-3 py-2 text-[11px]">
                              <div>
                                <p className="font-black text-black/70">{cashDate(closing)}</p>
                                <p className="mt-0.5 font-semibold text-black/40">{signatureName(closing)}</p>
                              </div>
                              <strong className="shrink-0 text-[#A74758]">{formatMoney(moneyValue(answer(closing, CASH_CLOSING_FIELD_IDS.withdrawn)))}</strong>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>

                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:w-[600px] shrink-0">
                    <StoreValue label="Cash cassa" value={formatMoney(row.total)} />
                    <StoreValue label="Cassaforte out" value={formatMoney(row.vaultTotal)} />
                    <StoreValue label="Netto sede" value={formatMoney(row.net)} />
                    <div className="flex flex-col justify-between rounded-md border border-black/10 bg-[#FAF7F9] p-3">
                      <p className="text-[10px] font-black uppercase text-black/35">Oggi</p>
                      <div className="mt-2 flex flex-col gap-1">
                        <div>
                          {row.today.length > 0 ? (
                            <Badge tone="green">{row.today.length} reg.</Badge>
                          ) : (
                            <Badge tone="pink">Manca</Badge>
                          )}
                        </div>
                        {row.discrepancies.length > 0 ? (
                          <span className="text-[10px] font-bold text-[#A74758]">{row.discrepancies.length} fondo diff.</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {orphanResponses.length > 0 ? (
                <div className="p-5 text-sm font-semibold text-black/50">
                  {orphanResponses.length} chiusure senza sede assegnata sono incluse nei totali generali.
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="-mx-4 rounded-none bg-[#111017] p-5 text-white shadow-none sm:mx-0 sm:rounded-lg">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F7DFA7]">Oggi</p>
            <h2 className="mt-1 text-2xl font-black">Chiusure ricevute</h2>
            <div className="mt-5 space-y-3">
              {todayResponses.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-white/45">Nessuna chiusura registrata oggi.</p>
              ) : null}
              {todayResponses.map((response) => {
                const fund = moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.fund));
                const hasFundIssue = Math.abs(fund - 50) > 0.009;
                return (
                  <div key={response.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">{response.user_location_name || response.location?.name || "Sede non indicata"}</p>
                        <p className="mt-1 text-xs text-white/45">{cashDate(response)}</p>
                      </div>
                      {hasFundIssue ? <AlertTriangle className="size-5 text-[#F7DFA7]" /> : <CheckCircle2 className="size-5 text-emerald-300" />}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-white/[0.06] p-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-white/35">Prelevato</p>
                        <div className="mt-1"><CashClosingAmountEditor closingId={response.id} currentAmount={moneyValue(answer(response, CASH_CLOSING_FIELD_IDS.withdrawn))} canEdit={canEditClosingAmount} dark align="left" /></div>
                      </div>
                      <MiniDark label="Fondo" value={formatMoney(fund)} />
                    </div>
                    <div className="mt-4 rounded-2xl bg-white/5 p-3">
                      <p className="flex items-center gap-2 text-xs font-bold text-white/70">
                        <PenLine className="size-4 text-[#F7DFA7]" />
                        {signatureName(response)}
                      </p>
                      <p className="mt-1 text-[11px] text-white/38">Firma PIN verificata</p>
                    </div>
                    <div className="mt-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${cashReviewClass(cashReview(response).status)}`}>
                        {cashReviewLabel(cashReview(response).status)}
                      </span>
                      {cashReview(response).note ? (
                        <p className="mt-2 rounded-2xl border border-white/10 p-3 text-xs leading-5 text-white/55">
                          Nota responsabile: {cashReview(response).note}
                        </p>
                      ) : null}
                    </div>
                    {answer(response, CASH_CLOSING_FIELD_IDS.notes) ? (
                      <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 p-3 text-xs leading-5 text-white/55">{String(answer(response, CASH_CLOSING_FIELD_IDS.notes))}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        <Card id="prelievi-autorizzati" className="-mx-4 scroll-mt-6 overflow-hidden rounded-none border-y border-black/10 bg-white p-0 shadow-none sm:mx-0 sm:rounded-lg sm:border">
          <div className="flex flex-col gap-3 border-b border-black/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A74758]">Cassaforte</p>
              <h2 className="mt-1 text-2xl font-black">Prelievi autorizzati</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-black/45">Gli ultimi prelievi del mese, ordinati dal più recente. Ogni registrazione mostra importo, motivo, sede, operatore e ricevuta.</p>
            </div>
            <div className="rounded-2xl bg-[#111017] px-4 py-3 text-right text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Totale uscito</p>
              <p className="text-lg font-black">{formatMoney(totalVaultOut)}</p>
            </div>
          </div>
          <div className="divide-y divide-black/5">
            {visibleVaultWithdrawals.map((response, index) => {
              const dateLabel = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(vaultAccountingDate(response));
              const receipt = answer(response, VAULT_WITHDRAWAL_FIELD_IDS.receipt) as { url?: string; name?: string } | null;
              return (
                <article key={response.id} className="grid gap-4 p-5 transition hover:bg-[#FFFBFD] lg:grid-cols-[150px_170px_1fr_230px] lg:items-center">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-black/35">Prelievo {index + 1}</p>
                    <p className="mt-1 font-black">{dateLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-black/35">Importo</p>
                    <p className="mt-1 text-lg font-black text-[#A74758]">{formatMoney(moneyValue(answer(response, VAULT_WITHDRAWAL_FIELD_IDS.amount)))}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-black/35">Motivo del prelievo</p>
                    <p className="mt-1 break-words text-sm font-semibold leading-6 text-black/65">
                      {String(answer(response, VAULT_WITHDRAWAL_FIELD_IDS.reason) || "Motivo non indicato")}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-black/40">
                      <MapPin className="size-3.5" />
                      {response.user_location_name || response.location?.name || "Sede non indicata"}
                    </p>
                    {receipt?.url ? (
                      <a href={receipt.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-black/5 bg-[#FAF7F9] p-2 pr-4 text-xs font-black text-[#A74758]">
                        <img src={receipt.url} alt={receipt.name || "Foto scontrino"} className="size-14 rounded-xl object-cover" />
                        Vedi foto scontrino
                      </a>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-[#FAF7F9] p-3">
                    <p className="text-[10px] font-black uppercase text-black/35">Prelevato da</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-black">
                      <UserRound className="size-4 text-[#A74758]" />
                      {signatureName(response)}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-black/35">
                      Registrato {new Date(response.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </article>
              );
            })}
            {vaultWithdrawals.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-bold text-black/40">Nessun prelievo cassaforte registrato per questo mese.</p>
              </div>
            ) : null}
          </div>
          {vaultWithdrawals.length > 3 ? (
            <div className="flex flex-col items-center gap-2 border-t border-black/5 bg-[#FAF7F9] px-5 py-4 sm:flex-row sm:justify-between">
              <p className="text-xs font-semibold text-black/45">
                {showAllVaultWithdrawals ? `Stai vedendo tutti i ${vaultWithdrawals.length} prelievi del mese.` : `Mostrati i 3 prelievi più recenti su ${vaultWithdrawals.length}.`}
              </p>
              <Link href={vaultToggleHref} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#111017] px-5 text-xs font-black text-white transition hover:bg-black">
                {showAllVaultWithdrawals ? "Mostra solo gli ultimi 3" : `Vedi gli altri ${vaultWithdrawals.length - 3}`}
                {showAllVaultWithdrawals ? <ChevronLeft className="size-4 rotate-90" /> : <ChevronRight className="size-4 rotate-90" />}
              </Link>
            </div>
          ) : null}
        </Card>

        <Card id="movimenti-cassa" className="-mx-4 scroll-mt-6 overflow-hidden rounded-none border-y border-black/10 bg-white p-0 shadow-none sm:mx-0 sm:rounded-lg sm:border">
          <div className="border-b border-black/5 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">Registro mensile</p>
                <h2 className="mt-1 text-2xl font-black">{movementFilter === "closings" ? "Chiusure cassa del mese" : "Tutti i movimenti"}</h2>
                <p className="mt-1 text-sm text-black/45">{movementFilter === "closings" ? "Sono mostrate soltanto le somme prelevate nelle chiusure cassa." : "Unisce chiusure cassa, prelievi cassaforte e transazioni del mese selezionato."}</p>
              </div>
              {movementFilter === "closings" ? (
                <Link href={`/cash?month=${selectedMonth}#movimenti-cassa`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 text-xs font-black text-black/65">
                  <X className="size-4" /> Mostra tutti i movimenti
                </Link>
              ) : null}
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">
                  <CreditCard className="size-4" /> Contanti attesi da Shopify
                </div>
                <p className="mt-2 text-2xl font-black tabular-nums text-sky-950">
                  {shopifyRevenue.available ? formatMoney(shopifyCashExpected) : "Non disponibile"}
                </p>
                <p className="mt-1 text-xs font-semibold text-sky-800/60">Transazioni contanti elaborate da Shopify.</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                  <Banknote className="size-4" /> Contanti dichiarati
                </div>
                <p className="mt-2 text-2xl font-black tabular-nums text-emerald-950">{formatMoney(totalWithdrawn)}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-800/60">Totale prelevato nelle chiusure, fondo escluso.</p>
              </div>
              <div className={`rounded-2xl border p-4 ${!shopifyRevenue.available || Math.abs(shopifyCashDifference) > 0.009 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] ${!shopifyRevenue.available || Math.abs(shopifyCashDifference) > 0.009 ? "text-amber-700" : "text-emerald-700"}`}>
                  {shopifyRevenue.available && Math.abs(shopifyCashDifference) <= 0.009 ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />} Scostamento da verificare
                </div>
                <p className={`mt-2 text-2xl font-black tabular-nums ${!shopifyRevenue.available || Math.abs(shopifyCashDifference) > 0.009 ? "text-amber-950" : "text-emerald-950"}`}>
                  {shopifyRevenue.available ? formatMoney(shopifyCashDifference) : "—"}
                </p>
                <p className="mt-1 text-xs font-semibold text-black/45">Dichiarato meno atteso. Positivo = contanti in più.</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#FAF7F9] text-[10px] font-black uppercase tracking-[0.14em] text-black/40 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                <tr>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Sede</th>
                  <th className="px-5 py-3">Operatore</th>
                  <th className="px-5 py-3 text-right">Importo</th>
                  <th className="px-5 py-3">Dettaglio</th>
                  <th className="px-5 py-3">Azioni rapide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {visibleMonthlyMovements.map((movement) => {
                  const review = movement.closing ? cashReview(movement.closing) : null;
                  const receipt = movement.vault
                    ? answer(movement.vault, VAULT_WITHDRAWAL_FIELD_IDS.receipt) as { url?: string; name?: string } | null
                    : null;
                  return (
                    <tr key={movement.id} className="align-top transition hover:bg-[#FFFBFD]">
                      <td className="px-5 py-4 font-bold">
                        {new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(movement.date)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${
                          movement.closing ? "bg-emerald-50 text-emerald-700" : "bg-pink-50 text-[#A74758]"
                        }`}>
                          {movement.kind}
                        </span>
                      </td>
                      <td className="px-5 py-4">{movement.locationName}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#FAF7F9] px-3 py-1 text-xs font-black text-black/70">
                          <UserRound className="size-3.5 text-[#A74758]" />
                          {movement.operator}
                        </span>
                      </td>
                      <td className={`px-5 py-4 text-right font-black ${movement.amountClass}`}>
                        {movement.closing ? (
                          <CashClosingAmountEditor closingId={movement.closing.id} currentAmount={movement.amount} canEdit={canEditClosingAmount} />
                        ) : formatMoney(movement.amount)}
                      </td>
                      <td className="max-w-[420px] px-5 py-4 text-xs leading-5 text-black/55">
                        <p className="font-semibold text-black/65">{movement.detail}</p>
                        {movement.note && movement.note !== "-" ? (
                          <div className="mt-2 rounded-xl border border-black/5 bg-[#FAF7F9] p-3">
                            <p className="text-[9px] font-black uppercase tracking-wider text-black/35">Note registrazione</p>
                            <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-black/55">{movement.note}</p>
                          </div>
                        ) : null}
                        {movement.closing && shopifyRevenue.available ? (
                          <div className="mt-2 rounded-xl border border-black/5 bg-[#FAF7F9] p-3">
                            <p className="text-[9px] font-black uppercase tracking-wider text-black/35">Confronto totale giornata</p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold">
                              <span>Atteso Shopify: <strong>{formatMoney(movement.expectedShopifyCash ?? 0)}</strong></span>
                              <span>Dichiarato: <strong>{formatMoney(movement.declaredCashForDay ?? 0)}</strong></span>
                              <span className={Math.abs((movement.declaredCashForDay ?? 0) - (movement.expectedShopifyCash ?? 0)) <= 0.009 ? "text-emerald-700" : "text-amber-700"}>
                                Differenza: <strong>{formatMoney((movement.declaredCashForDay ?? 0) - (movement.expectedShopifyCash ?? 0))}</strong>
                              </span>
                            </div>
                          </div>
                        ) : null}
                        {receipt?.url ? (
                          <a href={receipt.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex font-black text-[#A74758] underline-offset-4 hover:underline">
                            Vedi foto scontrino
                          </a>
                        ) : null}
                      </td>
                      <td className="min-w-[320px] px-5 py-4">
                        {movement.closing ? <CashReviewActions closingId={movement.closing.id} initialReview={review!} compact /> : <span className="text-xs font-semibold text-black/35">Registrato</span>}
                      </td>
                    </tr>
                  );
                })}
                {visibleMonthlyMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm font-semibold text-black/40">Nessun movimento nel mese corrente.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function MetricCard({ href, label, value, note, icon: Icon, tone }: { href: string; label: string; value: string; note: string; icon: LucideIcon; tone: "gold" | "blue" | "pink" | "green" }) {
  const tones = {
    gold: "bg-[#FFF9E9] text-[#8A6A19]",
    blue: "bg-[#F2F5FF] text-[#4D61A8]",
    pink: "bg-[#FFF1F5] text-[#A74758]",
    green: "bg-[#EEFBF5] text-emerald-700",
  };
  return (
    <Link href={href} className={`group min-h-32 border-b border-black/10 p-4 last:border-b-0 odd:border-r transition hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 lg:border-b-0 lg:border-r lg:last:border-r-0 ${tones[tone]} sm:p-5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">{label}</span>
        <span className="grid size-8 place-items-center rounded-full bg-white/60"><Icon className="size-4" /></span>
      </div>
      <p className="mt-3 text-xl font-black tracking-tight text-[#111017] sm:text-2xl">{value}</p>
      <p className="mt-2 flex items-center gap-1 text-[11px] font-bold opacity-65">{note}<ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" /></p>
    </Link>
  );
}

function StoreValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between rounded-md border border-black/10 bg-[#FAF7F9] p-3">
      <p className="text-[10px] font-black uppercase text-black/35 tracking-wider leading-none">{label}</p>
      <p className="mt-2 text-base font-black text-[#171717] leading-none">{value}</p>
    </div>
  );
}

function MiniDark({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/5 p-3">
      <p className="text-[10px] font-black uppercase text-white/35">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
