export const SHIFT_REPORT_STATUSES = ["DRAFT", "DA_VERIFICARE", "DA_CORREGGERE", "APPROVATO"] as const;
export type ShiftReportStatus = typeof SHIFT_REPORT_STATUSES[number];

export type ShiftReportData = {
  daySummary: string;
  dayRating: number;
  staffPresentation: string;
  breaks: string;
  cleanliness: string;
  materials: string;
  clientIssues: string;
  refusedServices: string;
  anomalies: string;
  clientChecks: Record<string, { status: "OK" | "PROBLEM" | ""; note: string }>;
  finishedProducts: Array<{ id: string; name: string }>;
};

export const emptyShiftReportData: ShiftReportData = {
  daySummary: "",
  dayRating: 3,
  staffPresentation: "",
  breaks: "",
  cleanliness: "",
  materials: "",
  clientIssues: "",
  refusedServices: "",
  anomalies: "",
  clientChecks: {},
  finishedProducts: [],
};

export function normalizeShiftReportData(value: unknown): ShiftReportData {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const text = (key: keyof ShiftReportData) => String(raw[key] ?? "").trim().slice(0, 5000);
  const rating = Math.min(5, Math.max(1, Number(raw.dayRating) || 3));
  const rawClientChecks = raw.clientChecks && typeof raw.clientChecks === "object" && !Array.isArray(raw.clientChecks)
    ? raw.clientChecks as Record<string, unknown>
    : {};
  const clientChecks = Object.fromEntries(Object.entries(rawClientChecks).slice(0, 250).map(([id, value]) => {
    const check = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const status: "OK" | "PROBLEM" | "" = check.status === "OK" || check.status === "PROBLEM" ? check.status : "";
    return [id.slice(0, 100), { status, note: String(check.note ?? "").trim().slice(0, 2000) }];
  }));
  const finishedProducts = Array.isArray(raw.finishedProducts)
    ? raw.finishedProducts.slice(0, 250).flatMap((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const product = value as Record<string, unknown>;
        const id = String(product.id ?? "").trim().slice(0, 100);
        const name = String(product.name ?? "").trim().slice(0, 200);
        return id && name ? [{ id, name }] : [];
      })
    : [];
  return {
    daySummary: text("daySummary"),
    dayRating: rating,
    staffPresentation: text("staffPresentation"),
    breaks: text("breaks"),
    cleanliness: text("cleanliness"),
    materials: text("materials"),
    clientIssues: text("clientIssues"),
    refusedServices: text("refusedServices"),
    anomalies: text("anomalies"),
    clientChecks,
    finishedProducts,
  };
}

export function shiftReportStatusLabel(status: string) {
  return ({
    DRAFT: "Bozza",
    DA_VERIFICARE: "Da verificare",
    DA_CORREGGERE: "Da correggere",
    APPROVATO: "Approvato definitivo",
  } as Record<string, string>)[status] ?? status;
}

export function romeDayRange(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && year >= 2020 && month >= 1 && month <= 12 && date >= 1 && date <= 31;
  if (!valid) throw new Error("Data non valida");
  const instantForMidnight = (targetDay: string) => {
    const [targetYear, targetMonth, targetDate] = targetDay.split("-").map(Number);
    const noon = new Date(Date.UTC(targetYear, targetMonth - 1, targetDate, 12));
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(noon);
    const part = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
    const representedAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    return new Date(Date.UTC(targetYear, targetMonth - 1, targetDate) - (representedAsUtc - noon.getTime()));
  };
  const nextAnchor = new Date(Date.UTC(year, month - 1, date, 12));
  nextAnchor.setUTCDate(nextAnchor.getUTCDate() + 1);
  const nextDay = nextAnchor.toISOString().slice(0, 10);
  return {
    date: new Date(`${day}T00:00:00.000Z`),
    start: instantForMidnight(day),
    end: instantForMidnight(nextDay),
  };
}

export function answerText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(answerText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.name ?? record.label ?? record.value ?? record.text ?? "").trim();
  }
  return String(value).trim();
}
