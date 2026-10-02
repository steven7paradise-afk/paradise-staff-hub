export function personalLeavePayload(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)) return null;
  if (p.type !== "FERIE" && p.type !== "PERMESSO" && p.type !== "MALATTIA") return null;
  function date(value: unknown) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  }
  const start = date(p.startDate), end = date(p.endDate);
  if (!start || !end || end < start) return null;
  const a = p.startTime ?? null, b = p.endTime ?? null;
  if (a !== null || b !== null) {
    if (p.type !== "PERMESSO" || typeof a !== "string" || typeof b !== "string"
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b)
      || b <= a || start.getTime() !== end.getTime()) return null;
  }
  if (p.reason !== undefined && (typeof p.reason !== "string" || p.reason.length > 2000)) return null;
  if (p.medicalCode != null && (typeof p.medicalCode !== "string" || p.medicalCode.length > 200)) return null;
  const medicalCode = p.type === "MALATTIA" && typeof p.medicalCode === "string" ? p.medicalCode.trim() || null : null;
  return { medical_code: medicalCode, sickness_unjustified: p.type === "MALATTIA" && !medicalCode, id: p.id.toLowerCase(), type: p.type as "FERIE" | "PERMESSO" | "MALATTIA", start_date: start, end_date: end, start_time: a as string | null,
    end_time: b as string | null, reason: (typeof p.reason === "string" ? p.reason.trim() : "") };
}

export function medicalCodePayload(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== "string" || !p.id.trim() || p.id.length > 200
    || typeof p.medicalCode !== "string" || !p.medicalCode.trim() || p.medicalCode.length > 200) return null;
  return { id: p.id, medicalCode: p.medicalCode.trim() };
}
