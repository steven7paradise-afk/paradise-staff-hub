export const WORKER_CONFIRMATION_TTL_MS = 60 * 60 * 1000;

type ConfirmationContext = {
  bookingId: string;
  operatorId: string;
  salon: string;
  workerId: string;
};
type ConfirmationStorage = Pick<Storage, "getItem" | "setItem">;

function key(context: ConfirmationContext) {
  return `appointment-worker-confirmation:v1:${JSON.stringify([
    context.operatorId, context.salon, context.bookingId,
  ])}`;
}

// This is only a UX acknowledgement, never an authorization or attendance check.
export function hasRecentWorkerConfirmation(
  storage: ConfirmationStorage | null,
  context: ConfirmationContext,
  now = Date.now(),
) {
  if (!storage || !context.operatorId || !context.bookingId || !context.workerId) return false;
  try {
    const record = JSON.parse(storage.getItem(key(context)) || "null");
    return record?.workerId === context.workerId &&
      typeof record.confirmedAt === "number" &&
      now >= record.confirmedAt && now - record.confirmedAt < WORKER_CONFIRMATION_TTL_MS;
  } catch {
    return false;
  }
}

export function rememberWorkerConfirmation(
  storage: ConfirmationStorage | null,
  context: ConfirmationContext,
  now = Date.now(),
) {
  if (!storage || !context.operatorId || !context.bookingId || !context.workerId) return;
  try {
    storage.setItem(key(context), JSON.stringify({ workerId: context.workerId, confirmedAt: now }));
  } catch {
    // Restricted browser storage must not prevent editing the note.
  }
}

export function workerConfirmationSessionStorage(): ConfirmationStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
