export type AppointmentStatusValue =
  | "PRENOTATO"
  | "RIPROGRAMMATO"
  | "NON_PRESENTATO"
  | "INIZIATO"
  | "IN_ATTESA"
  | "COMPLETATO"
  | "ARRIVATO_IN_RITARDO"
  | "PAGATO";

export function normalizeAppointmentStatus(value?: string | null): AppointmentStatusValue | null {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "RIPROGRAMMATO":
    case "SPOSTATO":
    case "RESCHEDULED":
      return "RIPROGRAMMATO";
    case "NON_PRESENTATO":
    case "NO_SHOW":
      return "NON_PRESENTATO";
    case "ARRIVATA":
    case "ARRIVATO":
    case "ARRIVED":
    case "ARRIVATA_IN_RITARDO":
    case "ARRIVATO_IN_RITARDO":
    case "IN_RITARDO":
    case "IN_ATTESA":
    case "ATTESA":
      return "IN_ATTESA";
    case "INIZIATO":
    case "IN_LAVORAZIONE":
      return "INIZIATO";
    case "COMPLETATO":
    case "COMPLETA":
      return "COMPLETATO";
    case "PAGATO":
    case "PAID":
    case "PRENOTATO":
    case "CONFIRMED":
    case "CONFERMATO":
      return "PRENOTATO";
    default:
      return null;
  }
}

type StatusSource = { status?: string | null; updatedAt?: string | null; updatedBy?: string | null };

export function resolveAgendaAppointmentStatus(
  saved: StatusSource | undefined,
  sheet: StatusSource | undefined,
  preferSaved: boolean,
) {
  const sources = preferSaved ? [saved, sheet] : [sheet, saved];
  for (const source of sources) {
    const status = normalizeAppointmentStatus(source?.status);
    if (status) return { ...source, status };
  }
  return null;
}

export type AppointmentStatusChange = {
  status: AppointmentStatusValue;
  updatedAt: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  elapsedSeconds: number;
};

export function parseSavedAppointmentStatus(value: unknown): AppointmentStatusChange | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const status = typeof entry.status === "string" ? normalizeAppointmentStatus(entry.status) : null;
  if (!status || typeof entry.updatedAt !== "string" || !Number.isFinite(Date.parse(entry.updatedAt))) {
    return null;
  }
  return {
    status,
    updatedAt: entry.updatedAt,
    startedAt: typeof entry.startedAt === "string" ? entry.startedAt : null,
    stoppedAt: typeof entry.stoppedAt === "string" ? entry.stoppedAt : null,
    elapsedSeconds: typeof entry.elapsedSeconds === "number" ? entry.elapsedSeconds : 0,
  };
}

/** An in-flight save has no server timestamp yet. After acknowledgement, older snapshots cannot roll it back. */
export function visibleAppointmentStatusChange(
  change: AppointmentStatusChange | undefined,
  snapshotUpdatedAt: string | null | undefined,
) {
  if (!change || !change.updatedAt) return change;
  const snapshotTime = Date.parse(snapshotUpdatedAt ?? "");
  return !Number.isFinite(snapshotTime) || snapshotTime < Date.parse(change.updatedAt)
    ? change
    : undefined;
}
