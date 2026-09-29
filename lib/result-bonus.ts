export const RESULT_BONUS_START_MONTH = "2026-09";

export const RESULT_BONUS_LEVELS = {
  MASTER: { label: "Master", cap: 500 },
  AUTONOMA: { label: "Autonoma", cap: 300 },
  JUNIOR: { label: "Junior", cap: 200 },
} as const;

export type ResultBonusLevel = keyof typeof RESULT_BONUS_LEVELS;

/** null keeps the automatic monthly-cap / scheduled-days calculation. */
export type ResultBonusDailyValues = Record<ResultBonusLevel, number | null>;
export function defaultResultBonusDailyValues(): ResultBonusDailyValues {
  return { JUNIOR: null, AUTONOMA: null, MASTER: null };
}
export function parseResultBonusDailyValues(value: unknown): ResultBonusDailyValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Valori giornalieri non validi.");
  const values = defaultResultBonusDailyValues();
  for (const level of Object.keys(values) as ResultBonusLevel[]) {
    const amount = (value as Record<string, unknown>)[level];
    if (amount !== null && (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 10000
      || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001)) {
      throw new Error("Inserisci un valore giornaliero tra 0 e 10.000 €, con massimo due decimali.");
    }
    values[level] = amount as number | null;
  }
  return values;
}

export const RESULT_BONUS_DYNAMICS = {
  TABLE_PREVIOUS_STAFF: { label: "Sistemazione fasce · app. precedente", detail: "Solo per righe segnate Controllato, nel mese di inserimento, al nome in app. precedente. Non a chi sistema. Senza controllo non modifica i punti.", mode: "TRACK_ONLY", amount: 0 },
  LATE_ENTRY: { label: "Ritardo all’ingresso", detail: "Una volta per giornata con ingresso in ritardo.", mode: "ZERO_DAY", amount: 0 },
  LATE_BREAK: { label: "Ritardo dal rientro pausa", detail: "Una volta per giornata con almeno un rientro in ritardo.", mode: "ZERO_DAY", amount: 0 },
  ABSENCE: { label: "Assenza senza timbratura", detail: "Per giornata lavorativa trascorsa senza ingresso e senza giustificazione.", mode: "ZERO_DAY", amount: 0 },
  APPEARANCE: { label: "Presentabilità non conforme", detail: "Una volta per lavoratore e giornata con almeno un No esplicito in Presentabilità staff nel controllo di turno. Caselle vuote e risposte mancanti non contano. Include i richiami manuali, senza duplicare quello automatico della stessa giornata.", mode: "ZERO_DAY", amount: 0 },
  REWORK_OPERATOR: { label: "Rilavorazione imputabile allo staff", detail: "Per evento registrato e verificato.", mode: "ZERO_DAY", amount: 0 },
  NEGATIVE_REVIEW: { label: "Recensione negativa nominativa", detail: "Per recensione verificata e registrata.", mode: "ZERO_DAY", amount: 0 },
  REWORK_CLIENT: { label: "Rilavorazione per preferenza cliente", detail: "Per evento registrato.", mode: "TRACK_ONLY", amount: 0 },
  REWORK_PRODUCT: { label: "Rilavorazione per prodotto", detail: "Per evento registrato.", mode: "TRACK_ONLY", amount: 0 },
  EXTRA_APPOINTMENT: { label: "Appuntamento oltre il quinto", detail: "Per scheda aggiuntiva nella giornata, Master e Autonoma.", mode: "AMOUNT", amount: 5 },
  OFF_SHIFT: { label: "Lavoro nel giorno di riposo", detail: "Per giornata di riposo con ingresso timbrato.", mode: "AMOUNT", amount: 15 },
  POSITIVE_REVIEW: { label: "Recensione positiva oltre la ventesima", detail: "Per recensione nominativa registrata.", mode: "AMOUNT", amount: 2 },
  URGENT_AVAILABILITY: { label: "Disponibilità per un’urgenza", detail: "Per disponibilità confermata e registrata.", mode: "AMOUNT", amount: 5 },
  ZERO_REWORK: { label: "Mese senza rilavorazioni", detail: "Una volta a fine mese, senza rilavorazioni imputabili allo staff.", mode: "AMOUNT", amount: 15 },
  TRAINING: { label: "Formazione Junior", detail: "Per corso seguito e registrato, solo livello Junior.", mode: "AMOUNT", amount: 10 },
} as const;
export type ResultBonusDynamic = keyof typeof RESULT_BONUS_DYNAMICS;
export type ResultBonusRule = { mode: "ZERO_DAY" | "TRACK_ONLY" | "AMOUNT"; amount: number };
export type ResultBonusRules = Record<ResultBonusDynamic, ResultBonusRule>;
export function defaultResultBonusRules(): ResultBonusRules {
  return Object.fromEntries(Object.entries(RESULT_BONUS_DYNAMICS).map(([key, value]) => [key, { mode: value.mode, amount: value.amount }])) as ResultBonusRules;
}
export function parseResultBonusRules(value: unknown): ResultBonusRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Impostazioni dinamiche non valide.");
  const rules = defaultResultBonusRules();
  for (const key of Object.keys(rules) as ResultBonusDynamic[]) {
    const rule = (value as Record<string, ResultBonusRule>)[key];
    if (!rule || !["ZERO_DAY", "TRACK_ONLY", "AMOUNT"].includes(rule.mode)
      || typeof rule.amount !== "number" || !Number.isFinite(rule.amount) || Math.abs(rule.amount) > 10000
      || Math.abs(rule.amount * 100 - Math.round(rule.amount * 100)) > 0.000001) throw new Error("Inserisci importi validi, con massimo due decimali e tra −10.000 e +10.000 €.");
    if (rule.mode === "ZERO_DAY" && RESULT_BONUS_DYNAMICS[key].mode !== "ZERO_DAY") throw new Error("Questa dinamica non può azzerare una giornata.");
    rules[key] = { mode: rule.mode, amount: rule.mode === "AMOUNT" ? rule.amount : 0 };
  }
  return rules;
}
export function resultBonusRuleLabel(rule: ResultBonusRule) {
  if (rule.mode === "ZERO_DAY") return "Giornata a 0 €";
  if (rule.mode === "TRACK_ONLY") return "Solo segnalazione";
  return `${rule.amount >= 0 ? "+" : ""}${rule.amount.toLocaleString("it-IT")} punti`;
}

export const RESULT_BONUS_VALUES = {
  extraAppointment: 5,
  offShiftWork: 15,
  positiveReview: 2,
  urgentAvailability: 5,
  zeroRework: 15,
  training: 10,
} as const;

export type ResultBonusEventType =
  | "APPEARANCE"
  | "REWORK_OPERATOR"
  | "REWORK_CLIENT"
  | "REWORK_PRODUCT"
  | "NEGATIVE_REVIEW"
  | "POSITIVE_REVIEW"
  | "URGENT_AVAILABILITY"
  | "TRAINING";

export type ResultBonusConfig = {
  userId: string;
  level: ResultBonusLevel;
};

export type ResultBonusEvent = {
  id: string;
  userId: string;
  date: string;
  type: ResultBonusEventType | "PERSONAL_BONUS";
  amount?: number;
  evidence: string;
  actorId: string;
  actorName: string;
  createdAt: string;
};

export type ResultBonusDispute = {
  id: string;
  userId: string;
  targetId: string;
  targetDate: string;
  reason: string;
  status: "OPEN" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
};

export type ResultBonusAcknowledgement = {
  userId: string;
  at: string;
  actorName: string;
};

export type ResultBonusState = {
  version: 2;
  revision: number;
  configs: Record<string, ResultBonusConfig>;
  events: ResultBonusEvent[];
  disputes: ResultBonusDispute[];
  acknowledgements: Record<string, ResultBonusAcknowledgement>;
  rules?: ResultBonusRules;
  dailyValues?: ResultBonusDailyValues;
  ruleHistory?: Array<{ at: string; actorId: string; actorName: string; rules: ResultBonusRules; dailyValues?: ResultBonusDailyValues }>;
};

export type ResultBonusDay = {
  date: string;
  state: "CONFORMING" | "ZERO" | "NEUTRAL" | "PENDING" | "IN_PROGRESS" | "ADJUSTED";
  reasons: string[];
};

export type ResultBonusExtra = {
  id: string;
  date: string;
  label: string;
  amount: number;
  source: string;
};

export function blankResultBonusState(configs: Record<string, ResultBonusConfig> = {}): ResultBonusState {
  return { version: 2, revision: 0, configs, events: [], disputes: [], acknowledgements: {} };
}

export function resultBonusEventEffect(type: ResultBonusEventType | "PERSONAL_BONUS", level: ResultBonusLevel | null, rules?: ResultBonusRules) {
  if (rules && type !== "PERSONAL_BONUS") {
    const rule = rules[type];
    if (type === "TRAINING" && level !== "JUNIOR") return { kind: "BONUS" as const, amount: 0 };
    return { kind: rule.mode === "AMOUNT" ? "BONUS" as const : rule.mode, amount: rule.mode === "AMOUNT" ? rule.amount : 0 };
  }
  if (["APPEARANCE", "REWORK_OPERATOR", "NEGATIVE_REVIEW"].includes(type)) {
    return { kind: "ZERO_DAY" as const, amount: 0 };
  }
  if (type === "POSITIVE_REVIEW") return { kind: "BONUS" as const, amount: RESULT_BONUS_VALUES.positiveReview };
  if (type === "URGENT_AVAILABILITY") return { kind: "BONUS" as const, amount: RESULT_BONUS_VALUES.urgentAvailability };
  if (type === "TRAINING") return { kind: "BONUS" as const, amount: level === "JUNIOR" ? RESULT_BONUS_VALUES.training : 0 };
  return { kind: "TRACK_ONLY" as const, amount: 0 };
}

export function roundResultBonusUp(value: number, cap: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(cap, Math.ceil((value - 0.000001) / 10) * 10);
}

export function calculateResultBonus(input: {
  level: ResultBonusLevel | null;
  dailyValues?: ResultBonusDailyValues;
  days: ResultBonusDay[];
  extras: ResultBonusExtra[];
  disciplinaryLetter: boolean;
  finalized: boolean;
}) {
  const cap = input.level ? RESULT_BONUS_LEVELS[input.level].cap : 0;
  const eligibleDays = input.days.filter((day) => day.state !== "NEUTRAL").length;
  const conformingDays = input.days.filter((day) => day.state === "CONFORMING" || day.state === "IN_PROGRESS").length;
  const zeroDays = input.days.filter((day) => day.state === "ZERO").length;
  const neutralDays = input.days.filter((day) => day.state === "NEUTRAL").length;
  const pendingDays = input.days.filter((day) => day.state === "PENDING").length;
  const configuredDailyValue = input.level ? input.dailyValues?.[input.level] : null;
  const dailyValue = input.level ? (configuredDailyValue ?? (eligibleDays > 0 ? cap / eligibleDays : 0)) : 0;
  const adjustedDays = input.days.filter((day) => day.state === "ADJUSTED").length;
  const dayAmount = (conformingDays + adjustedDays) * dailyValue;
  const extraAmount = input.extras.reduce((sum, event) => sum + event.amount, 0);
  const dailyAmounts = resultBonusDailyAmounts(input.days, input.extras, dailyValue, cap, input.disciplinaryLetter);
  const exactAmount = Math.round(Object.values(dailyAmounts).reduce((sum, amount) => sum + amount, 0) * 100) / 100;
  const displayedAmount = input.finalized ? roundResultBonusUp(exactAmount, cap) : exactAmount;
  return {
    cap,
    eligibleDays,
    conformingDays,
    adjustedDays,
    zeroDays,
    neutralDays,
    pendingDays,
    dailyValue,
    dayAmount,
    extraAmount,
    dailyAmounts,
    dailyLosses: resultBonusDailyLosses(input.days, input.extras, dailyValue),
    exactAmount,
    displayedAmount,
    progress: cap > 0 ? Math.min(100, Math.round((exactAmount / cap) * 100)) : 0,
  };
}

/** Losses within each day, before the monthly cap; rest is never a lost workday. */
export function resultBonusDailyLosses(days: ResultBonusDay[], extras: ResultBonusExtra[], dailyValue: number) {
  const dates = new Set([...days.map((day) => day.date), ...extras.map((extra) => extra.date)]);
  return Object.fromEntries([...dates].map((date) => {
    const day = days.find((item) => item.date === date);
    const movements = extras.filter((item) => item.date === date);
    const positive = movements.reduce((sum, item) => sum + Math.max(0, item.amount), 0);
    const negative = movements.reduce((sum, item) => sum + Math.max(0, -item.amount), 0);
    const earnsBase = day && ["CONFORMING", "IN_PROGRESS", "ADJUSTED"].includes(day.state);
    const lostBase = day?.state === "ZERO" ? dailyValue : 0;
    const lost = lostBase + Math.min(negative, positive + (earnsBase ? dailyValue : 0));
    return [date, Math.round(lost * 100) / 100];
  }));
}

/** One point equals one euro. Deductions affect that day's earnings, never earlier days. */
export function resultBonusDailyAmounts(days: ResultBonusDay[], extras: ResultBonusExtra[], dailyValue: number, cap: number, disciplinaryLetter: boolean) {
  const totals = new Map<string, number>();
  for (const day of days) {
    if (day.state === "PENDING" || day.state === "NEUTRAL") continue;
    totals.set(day.date, ["CONFORMING", "IN_PROGRESS", "ADJUSTED"].includes(day.state) ? dailyValue : 0);
  }
  for (const extra of extras) totals.set(extra.date, (totals.get(extra.date) ?? 0) + extra.amount);
  let accrued = 0;
  let paidCents = 0;
  return Object.fromEntries([...totals].sort(([a], [b]) => a.localeCompare(b)).map(([date, raw]) => {
    accrued = disciplinaryLetter ? 0 : Math.min(cap, accrued + Math.max(0, raw));
    const totalCents = Math.round(accrued * 100);
    const amount = (totalCents - paidCents) / 100;
    paidCents = totalCents;
    return [date, amount];
  }));
}

export function validResultBonusMonth(month: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || month < RESULT_BONUS_START_MONTH) {
    throw new Error("Mese premio non valido.");
  }
  return month;
}
