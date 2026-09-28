import { bonusRules, type BonusRules } from "./monthly-bonus-rules";
/** Bonus Fase 2. Independent from the legacy communication/goal/redemption points. */
export const BONUS_START_DATE = "2026-09-28";
export const BONUS_START_MONTH = BONUS_START_DATE.slice(0, 7);
export const BONUS_POINT_EUROS = 5;
export const BONUS_LEVELS = {
  MASTER: { label: "Master", base: 50, cap: 100 },
  AUTONOMA: { label: "Autonoma", base: 30, cap: 60 },
  JUNIOR: { label: "Junior", base: 20, cap: 40 },
} as const;
export type BonusLevel = keyof typeof BONUS_LEVELS;
export type ReworkPolicy = "COMPLETED_BLOCK" | "STARTED_BLOCK";
export const BONUS_EVENT_LABELS = {
  ENTRY_LATE: "Ritardo ingresso mattina",
  BREAK_LATE: "Ritardo rientro pausa",
  DISCIPLINARY_LETTER: "Lettera di contestazione",
  APPEARANCE: "Richiamo presentabilità/outfit",
  REWORK: "Rilavorazione/sistemazione fasce",
  NEGATIVE_REVIEW: "Recensione negativa nominativa",
  EXTRA_APPOINTMENT: "Appuntamento extra oltre quota",
  SHIFT_CHANGE: "Cambio turno ultimo momento",
  POSITIVE_REVIEW: "Recensione positiva nominativa",
  URGENT_AVAILABILITY: "Reperibilità urgenza confermata",
  ZERO_REWORK: "Zero rilavorazioni nel mese",
  TRAINING: "Partecipazione a formazione",
  OFF_SHIFT_WORK: "Giornata lavorata fuori turno",
} as const;
export type BonusEventType = keyof typeof BONUS_EVENT_LABELS;
export type BonusActor = { id: string; name: string; role: string; active: boolean };
/** Explicit assignments: job titles and generic app permissions are not bonus permissions. */
export type BonusAssignment = {
  userId: string;
  level: BonusLevel;
  responsibleIds: string[];
  referenceMasterId: string | null;
};
export type BonusEvent = {
  id: string;
  sourceId: string;
  type: BonusEventType;
  date: string;
  recordedAt: string;
  actorId: string;
  actorName: string;
  evidence: string;
  ordinal: number;
  points: number;
  reason: string;
};
export type BonusAccount = {
  rules?: BonusRules;
  month: string;
  userId: string;
  level: BonusLevel;
  /** Frozen when the monthly account is opened; never carried from another month. */
  base: number;
  cap: number;
  reworkPolicy: ReworkPolicy | null;
  events: BonusEvent[];
};

export function romeBonusDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function usesMonthlyBonus(now = new Date()) {
  return romeBonusDay(now) >= BONUS_START_DATE;
}

export function createBonusAccount(month: string, assignment: BonusAssignment, reworkPolicy: ReworkPolicy | null): BonusAccount {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || month < BONUS_START_MONTH) {
    throw new Error("Il conto bonus decorre dal 28 settembre 2026.");
  }
  if (!Object.hasOwn(BONUS_LEVELS, assignment.level) || !assignment.userId.trim()) {
    throw new Error("Livello bonus o persona non assegnati.");
  }
  if (reworkPolicy !== null && !["COMPLETED_BLOCK", "STARTED_BLOCK"].includes(reworkPolicy)) {
    throw new Error("Regola rilavorazioni non valida.");
  }
  const { base, cap } = BONUS_LEVELS[assignment.level];
  return { month, userId: assignment.userId, level: assignment.level, base, cap, reworkPolicy, events: [] };
}

export function canRegisterBonus(actor: BonusActor, assignment: BonusAssignment, type: BonusEventType) {
  // Direction is read-only, even when it has generic admin editing permissions.
  if (type === 'OFF_SHIFT_WORK') return false; // Only the verified attendance importer can create these.
  if (!actor.active || ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(actor.role)) return false;
  const juniorOnly = type === "ZERO_REWORK" || type === "TRAINING";
  if (juniorOnly) return assignment.level === "JUNIOR" && actor.id === assignment.referenceMasterId;
  if (type === "EXTRA_APPOINTMENT" && assignment.level === "JUNIOR") return false;
  return assignment.responsibleIds.includes(actor.id);
}

export function bonusBalance(account: BonusAccount) {
  const bonus = account.events.reduce((sum, event) => sum + Math.max(0, event.points), 0);
  const malus = account.events.reduce((sum, event) => sum + Math.max(0, -event.points), 0);
  // Clamp the total, not each intermediate event: event order cannot change the balance.
  const points = Math.max(0, Math.min(account.cap, account.base + bonus - malus));
  return { base: account.base, cap: account.cap, bonus, malus, points, euros: points * BONUS_POINT_EUROS };
}

/** Completed appointment totals must come from a verified source, not review/form counts. */
export function extraAppointmentQuota(appointments: number, monthlyQuota: number) {
  if (![appointments, monthlyQuota].every(value => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error("Appuntamenti e quota mensile devono essere interi non negativi.");
  }
  const quota = monthlyQuota;
  const extra = Math.max(0, appointments - quota);
  return { quota, extra, points: extra * 0.5 };
}

export type NewBonusEvent = {
  id: string;
  /** Stable external identifier or request UUID, used for duplicate prevention. */
  sourceId: string;
  type: BonusEventType;
  date: string;
  evidence: string;
  namedReviewConfirmed?: boolean;
  zeroReworksConfirmed?: boolean;
};

function validDay(day: string) {
  return /^20\d{2}-\d{2}-\d{2}$/.test(day)
    && Number.isFinite(Date.parse(day))
    && new Date(day).toISOString().slice(0, 10) === day;
}

/** Preview and write must call this same calculation under a database transaction lock. */
export function previewBonusEvent(account: BonusAccount, input: NewBonusEvent, now = new Date()) {
  const today = romeBonusDay(now);
  if (!Object.hasOwn(BONUS_EVENT_LABELS, input.type)) throw new Error("Voce bonus non valida.");
  if (!validDay(input.date) || input.date.slice(0, 7) !== account.month || input.date > today || input.date < BONUS_START_DATE || account.month < BONUS_START_MONTH) {
    throw new Error("La data deve appartenere al mese del conto e non può essere futura.");
  }
  if (!input.id.trim() || !input.sourceId.trim() || !input.evidence.trim()) {
    throw new Error("Identificativo e riferimento dell’evento sono obbligatori.");
  }
  if (account.events.some(event => event.id === input.id || event.sourceId === input.sourceId)) {
    throw new Error("Evento già registrato.");
  }
  if (["NEGATIVE_REVIEW", "POSITIVE_REVIEW"].includes(input.type) && input.namedReviewConfirmed !== true) {
    throw new Error("La recensione deve nominare esplicitamente la persona; altrimenti è del team/reception.");
  }
  if (["ZERO_REWORK", "TRAINING"].includes(input.type) && account.level !== "JUNIOR") {
    throw new Error("Bonus riservato alle Junior.");
  }
  if (input.type === "EXTRA_APPOINTMENT" && account.level === "JUNIOR") {
    throw new Error("Appuntamenti extra riservati a Master e Autonome.");
  }
  const rules=bonusRules(account.rules);
  const ordinal = account.events.filter(event => event.type === input.type).length + 1;
  let points = 0;
  let reason = "";
  switch (input.type) {
    case "ENTRY_LATE":
    case "BREAK_LATE":
    case "APPEARANCE": {
      const free = input.type === "APPEARANCE" ? rules.appearanceGrace : input.type === "BREAK_LATE" ? rules.breakGrace : rules.entryGrace;
      points = ordinal > free ? (input.type === "BREAK_LATE" ? -rules.breakPenalty : input.type === "APPEARANCE" ? -rules.appearancePenalty : -rules.entryPenalty) : 0;
      reason = `${ordinal}° evento registrato nel mese: ${ordinal <= free ? `entro la franchigia di ${free}` : "oltre franchigia"}.`;
      break;
    }
    case "REWORK": {
      if (!account.reworkPolicy) throw new Error("La regola dei blocchi di rilavorazioni deve essere confermata.");
      if (account.events.some(event => event.type === "ZERO_REWORK")) {
        throw new Error("Bonus zero rilavorazioni già registrato: serve una correzione concordata e tracciata.");
      }
      const charge = ordinal > rules.reworkFree && (account.reworkPolicy === "COMPLETED_BLOCK" ? (ordinal-rules.reworkFree) % rules.reworkBlock === 0 : (ordinal-rules.reworkFree-1) % rules.reworkBlock === 0);
      points = charge ? -rules.reworkPenalty : 0;
      reason = `${ordinal}ª rilavorazione: ${ordinal <= rules.reworkFree ? `entro le ${rules.reworkFree} gratuite` : charge ? "blocco soggetto a malus" : "nessun nuovo malus per questo blocco"}.`;
      break;
    }
    case "POSITIVE_REVIEW":
      points = ordinal > rules.positiveReviewThreshold ? rules.positiveReviewPoints : 0;
      reason = `${ordinal}ª recensione nominativa: ${ordinal <= rules.positiveReviewThreshold ? `soglia di ${rules.positiveReviewThreshold} non superata` : `oltre la soglia di ${rules.positiveReviewThreshold}`}.`;
      break;
    case "NEGATIVE_REVIEW": points = -rules.negativeReviewPenalty; break;
    case "DISCIPLINARY_LETTER": points = -rules.letterPenalty; break;
    case "EXTRA_APPOINTMENT": points = rules.extraAppointmentPoints; break;
    case "SHIFT_CHANGE": points = rules.shiftChangePoints; break;
    case "URGENT_AVAILABILITY": points = rules.urgencyPoints; break;
    case "TRAINING": points = rules.trainingPoints;
      break;
    case "OFF_SHIFT_WORK": points = rules.offShiftDayPoints; break;
    case "ZERO_REWORK":
      if (account.month >= today.slice(0, 7)) throw new Error("Zero rilavorazioni si verifica solo dopo la fine del mese.");
      if (input.zeroReworksConfirmed !== true || account.events.some(event => event.type === "REWORK")) {
        throw new Error("Occorre verificare l’assenza di rilavorazioni nell’intero mese.");
      }
      if (ordinal !== 1) throw new Error("Bonus zero rilavorazioni già registrato per questo mese.");
      points = rules.zeroReworkPoints;
      break;
  }
  return { ordinal, points, reason: reason || BONUS_EVENT_LABELS[input.type] };
}

/** Immutable append; tolerated events are stored too, so monthly thresholds remain auditable. */
export function appendBonusEvent(account: BonusAccount, assignment: BonusAssignment, actor: BonusActor, input: NewBonusEvent, now = new Date()): BonusAccount {
  if (assignment.userId !== account.userId || assignment.level !== account.level
    || !canRegisterBonus(actor, assignment, input.type)) {
    throw new Error("Non puoi registrare questa voce per questa persona.");
  }
  const calculated = previewBonusEvent(account, input, now);
  const event: BonusEvent = {
    id: input.id, sourceId: input.sourceId, type: input.type, date: input.date,
    recordedAt: now.toISOString(), actorId: actor.id, actorName: actor.name,
    evidence: input.evidence.trim(), ...calculated,
  };
  return { ...account, events: [...account.events, event] };
}
