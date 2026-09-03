export const SHIFT_RESPONSIBLE_ACCESS_KEY = "shift_responsible_access";

export type ShiftAccessStatus = "PENDING" | "APPROVED" | "DENIED";

export type ShiftResponsibleAccessDay = {
  acknowledgements: Record<string, { at: string; clockIn: string | null; shiftStatus: string }>;
  permissions: Record<string, { status: ShiftAccessStatus; requestedAt: string; decidedAt?: string; decidedBy?: string }>;
  audit: Array<{ id: string; questionId: string; actorId: string; actorName: string; at: string; action: "ANSWER"; previousValue?: string; nextValue?: string }>;
};

export type ShiftResponsibleAccess = Record<string, ShiftResponsibleAccessDay>;

export function emptyShiftAccessDay(): ShiftResponsibleAccessDay {
  return { acknowledgements: {}, permissions: {}, audit: [] };
}

export function normalizeShiftResponsibleAccess(value: unknown): ShiftResponsibleAccess {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([day, rawDay]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !rawDay || typeof rawDay !== "object" || Array.isArray(rawDay)) return [];
    const raw = rawDay as Record<string, unknown>;
    const acknowledgements = raw.acknowledgements && typeof raw.acknowledgements === "object" && !Array.isArray(raw.acknowledgements)
      ? Object.fromEntries(Object.entries(raw.acknowledgements as Record<string, unknown>).flatMap(([userId, item]) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const entry = item as Record<string, unknown>;
          const at = String(entry.at ?? "");
          return at ? [[userId, { at, clockIn: typeof entry.clockIn === "string" ? entry.clockIn : null, shiftStatus: String(entry.shiftStatus ?? "Non timbrato") }]] : [];
        })) : {};
    const permissions = raw.permissions && typeof raw.permissions === "object" && !Array.isArray(raw.permissions)
      ? Object.fromEntries(Object.entries(raw.permissions as Record<string, unknown>).flatMap(([userId, item]) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const entry = item as Record<string, unknown>;
          const status = ["PENDING", "APPROVED", "DENIED"].includes(String(entry.status)) ? String(entry.status) as ShiftAccessStatus : "PENDING";
          return [[userId, { status, requestedAt: String(entry.requestedAt ?? ""), decidedAt: typeof entry.decidedAt === "string" ? entry.decidedAt : undefined, decidedBy: typeof entry.decidedBy === "string" ? entry.decidedBy : undefined }]];
        })) : {};
    const audit = Array.isArray(raw.audit) ? raw.audit.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const entry = item as Record<string, unknown>;
      if (!entry.id || !entry.questionId || !entry.actorId || !entry.at) return [];
      return [{
        id: String(entry.id),
        questionId: String(entry.questionId),
        actorId: String(entry.actorId),
        actorName: String(entry.actorName ?? "Utente"),
        at: String(entry.at),
        action: "ANSWER" as const,
        previousValue: typeof entry.previousValue === "string" ? entry.previousValue.slice(0, 12000) : undefined,
        nextValue: typeof entry.nextValue === "string" ? entry.nextValue.slice(0, 12000) : undefined,
      }];
    }).slice(-300) : [];
    return [[day, { acknowledgements, permissions, audit }]];
  }));
}

export function hasShiftWriteAccess(day: ShiftResponsibleAccessDay, userId: string, selectedResponsibleId?: string) {
  if (!day.acknowledgements[userId]) return false;
  return userId === selectedResponsibleId || day.permissions[userId]?.status === "APPROVED";
}
