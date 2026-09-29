import type { Prisma } from "@prisma/client";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { resolveCanonicalStaffName } from "@/lib/client-control-normalize";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { prisma } from "@/lib/prisma";
import { ASSISTANCE_TABLES_KEY, normalizeAssistanceSheets } from "@/lib/assistance-tables";
import { resultBonusTableOccurrences } from "@/lib/result-bonus-tables";
import { resultBonusAppearanceEvents } from "@/lib/result-bonus-appearance";
import { SHIFT_RESPONSIBLE_ANSWERS_KEY, SHIFT_RESPONSIBLE_QUESTIONS_KEY } from "@/lib/shift-responsible-questions";
import {
  RESULT_BONUS_LEVELS,
  defaultResultBonusRules,
  defaultResultBonusDailyValues,
  parseResultBonusDailyValues,
  parseResultBonusRules,
  resultBonusRuleLabel,
  blankResultBonusState,
  calculateResultBonus,
  resultBonusEventEffect,
  validResultBonusMonth,
  type ResultBonusConfig,
  type ResultBonusDay,
  type ResultBonusExtra,
  type ResultBonusLevel,
  type ResultBonusState,
  type ResultBonusDynamic,
} from "@/lib/result-bonus";

export const RESULT_BONUS_SETTING_PREFIX = "result_bonus:";

type AccessActor = { id: string; name: string; role: string; active: boolean; sede_id?: string | null };

function isDirection(role: string) {
  return ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(role);
}

function belongsToBuenosAires(name: string | null | undefined) {
  return /buenos\s*aires/i.test(name ?? "");
}

function monthBounds(month: string) {
  validResultBonusMonth(month);
  const [year, value] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, value - 1, 1)),
    end: new Date(Date.UTC(year, value, 1)),
    year,
    monthNumber: value,
  };
}

function romeDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function romeMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value("hour") * 60 + value("minute");
}

function clockMinutes(value?: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isWorkCategory(category: { code: string; name: string }) {
  const code = category.code.toUpperCase();
  const name = category.name.toLowerCase();
  const excludedCodes = ["R", "RI", "R3", "F", "FE", "P", "PE", "M", "MA", "ML", "A", "AI", "NL", "ND", "NLA", "C", "CH", "C3"];
  const excludedNames = ["riposo", "ferie", "permesso", "malattia", "assenza", "chiuso", "non lavora", "no lavoro"];
  return !excludedCodes.includes(code) && !excludedNames.some((word) => name.includes(word));
}

function names(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(names);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return names(record.name ?? record.label ?? record.value ?? "");
  }
  return String(value ?? "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
}

function legacyConfigs(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const configs = (value as { configs?: unknown }).configs;
  if (!configs || typeof configs !== "object" || Array.isArray(configs)) return {};
  return Object.fromEntries(Object.entries(configs as Record<string, unknown>).flatMap(([userId, raw]) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const level = String((raw as Record<string, unknown>).level) as ResultBonusLevel;
    if (!Object.hasOwn(RESULT_BONUS_LEVELS, level)) return [];
    return [[userId, { userId, level } satisfies ResultBonusConfig]];
  }));
}

function normalizeState(value: unknown): ResultBonusState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<ResultBonusState>;
  if (raw.version !== 2 || !raw.configs || typeof raw.configs !== "object") return null;
  return {
    version: 2,
    revision: Number(raw.revision) || 0,
    configs: raw.configs,
    events: Array.isArray(raw.events) ? raw.events : [],
    disputes: Array.isArray(raw.disputes) ? raw.disputes : [],
    acknowledgements: raw.acknowledgements && typeof raw.acknowledgements === "object" ? raw.acknowledgements : {},
    rules: raw.rules ? parseResultBonusRules({ ...defaultResultBonusRules(), ...raw.rules }) : defaultResultBonusRules(),
    dailyValues: raw.dailyValues ? parseResultBonusDailyValues(raw.dailyValues) : defaultResultBonusDailyValues(),
    ruleHistory: Array.isArray(raw.ruleHistory) ? raw.ruleHistory : [],
  };
}

export async function loadResultBonusState(month: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  validResultBonusMonth(month);
  const exact = await tx.setting.findUnique({ where: { key: RESULT_BONUS_SETTING_PREFIX + month }, select: { value: true } });
  const normalized = normalizeState(exact?.value);
  if (normalized) return normalized;

  const previous = await tx.setting.findFirst({
    where: { key: { startsWith: RESULT_BONUS_SETTING_PREFIX, lt: RESULT_BONUS_SETTING_PREFIX + month } },
    orderBy: { key: "desc" },
    select: { value: true },
  });
  const previousState = normalizeState(previous?.value);
  if (previousState) return { ...blankResultBonusState(previousState.configs), rules: previousState.rules, dailyValues: previousState.dailyValues };

  const legacy = await tx.setting.findFirst({
    where: { key: { startsWith: "monthly_bonus:", lte: `monthly_bonus:${month}` } },
    orderBy: { key: "desc" },
    select: { value: true },
  });
  return blankResultBonusState(legacyConfigs(legacy?.value));
}

export async function saveResultBonusState(month: string, state: ResultBonusState, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  return tx.setting.upsert({
    where: { key: RESULT_BONUS_SETTING_PREFIX + validResultBonusMonth(month) },
    update: { value: state as unknown as Prisma.InputJsonValue },
    create: { key: RESULT_BONUS_SETTING_PREFIX + month, value: state as unknown as Prisma.InputJsonValue },
  });
}

function breakDelayMinutes(logs: { type: string; timestamp: Date }[], limit: number) {
  let pauseAt: Date | null = null;
  let delay = 0;
  for (const log of [...logs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
    if (log.type === "PAUSA") pauseAt = log.timestamp;
    if (log.type === "RIENTRO" && pauseAt) {
      const duration = Math.ceil((log.timestamp.getTime() - pauseAt.getTime()) / 60_000);
      delay += Math.max(0, duration - limit);
      pauseAt = null;
    }
  }
  return delay;
}

function manualEventLabel(type: string) {
  return ({
    APPEARANCE: "Richiamo presentabilità",
    REWORK_OPERATOR: "Rilavorazione imputabile all’operatrice",
    REWORK_CLIENT: "Rilavorazione: preferenza cliente",
    REWORK_PRODUCT: "Rilavorazione: prodotto",
    NEGATIVE_REVIEW: "Recensione negativa nominativa",
    POSITIVE_REVIEW: "Recensione positiva nominativa oltre la 20ª",
    URGENT_AVAILABILITY: "Reperibilità urgenza confermata",
    TRAINING: "Corso di formazione seguito",
  } as Record<string, string>)[type] ?? type;
}

export async function buildResultBonusData(actor: AccessActor, month: string, selfOnly = false, db = prisma) {
  const { start, end, year, monthNumber } = monthBounds(month);
  const state = await loadResultBonusState(month, db);
  const rules = state.rules ?? defaultResultBonusRules();
  const people = await db.user.findMany({
    where: {
      active: true,
      role: { in: ["RESPONSABILE", "DIPENDENTE"] },
      location: { name: { contains: "Buenos", mode: "insensitive" } },
    },
    select: { id: true, name: true, role: true, mansione: true, photo_url: true, sede_id: true, location: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const canManage = mayManageResultBonus(actor);
  const visiblePeople = !selfOnly && canManage ? people : people.filter((person) => person.id === actor.id);
  const ids = visiblePeople.map((person) => person.id);
  const allNames = people.map((person) => person.name);

  const [schedules, logs, leaves, documents, responses, clockSettings, tables, shiftSettings] = await Promise.all([
    db.scheduleEntry.findMany({ where: { user_id: { in: ids }, date: { gte: start, lt: end } }, include: { category: true } }),
    db.attendanceLog.findMany({ where: { user_id: { in: ids }, date: { gte: start, lt: end } }, orderBy: { timestamp: "asc" } }),
    db.leaveRequest.findMany({ where: { user_id: { in: ids }, status: "APPROVED", start_date: { lt: end }, end_date: { gte: start } } }),
    db.document.findMany({
      where: {
        user_id: { in: ids },
        OR: [{ document_date: { gte: start, lt: end } }, { document_date: null, created_at: { gte: start, lt: end } }],
      },
      select: { id: true, user_id: true, type: true, title: true, document_date: true, created_at: true },
    }),
    db.serviceFormResponse.findMany({ where: { created_at: { gte: start, lt: end } }, include: { form: { select: { name: true, category: true } } } }),
    db.setting.findMany({ where: { key: { startsWith: "clock_rule:" } }, select: { key: true, value: true } }),
    db.setting.findUnique({ where: { key: ASSISTANCE_TABLES_KEY }, select: { value: true } }),
    db.setting.findMany({ where: { key: { in: [SHIFT_RESPONSIBLE_QUESTIONS_KEY, SHIFT_RESPONSIBLE_ANSWERS_KEY] } }, select: { key: true, value: true } }),
  ]);
  const tableOccurrences = resultBonusTableOccurrences(normalizeAssistanceSheets(tables?.value), month, people);

  const validResponses = responses
    .filter((response) => isClientControlFormName(response.form.name, response.form.category))
    .filter((response) => {
      const answers = response.answers as Record<string, unknown>;
      return !Boolean(answers.client_control_is_draft)
        && String(answers[CLIENT_CONTROL_FIELD_IDS.correctness] ?? "").trim().toLowerCase() !== "errore";
    });
  const today = romeDayKey();
  const currentMonth = today.slice(0, 7);
  const finalized = month < currentMonth;
  const appearanceEvents = resultBonusAppearanceEvents(
    shiftSettings.find((setting) => setting.key === SHIFT_RESPONSIBLE_QUESTIONS_KEY)?.value,
    shiftSettings.find((setting) => setting.key === SHIFT_RESPONSIBLE_ANSWERS_KEY)?.value,
    month, today, ids,
  );

  const reports = visiblePeople.map((person) => {
    const config = state.configs[person.id];
    const level = config?.level ?? null;
    const personSchedules = schedules.filter((entry) => entry.user_id === person.id);
    const workSchedules = personSchedules.filter((entry) => isWorkCategory(entry.category));
    const logsByDay = new Map<string, typeof logs>();
    logs.filter((log) => log.user_id === person.id).forEach((log) => {
      const key = dayKey(log.date);
      logsByDay.set(key, [...(logsByDay.get(key) ?? []), log]);
    });
    const personLeaves = leaves.filter((leave) => leave.user_id === person.id);
    const savedEvents = state.events.filter((event) => event.userId === person.id && event.date.startsWith(month));
    const automaticAppearance = appearanceEvents.filter((event) => event.userId === person.id
      && !savedEvents.some((manual) => manual.type === "APPEARANCE" && manual.date === event.date)
      && !state.disputes.some((dispute) => dispute.userId === person.id && dispute.targetId === `day:${person.id}:${event.date}` && dispute.status === "ACCEPTED"));
    const manualEvents = [...savedEvents, ...automaticAppearance];
    const eventLabel = (event: (typeof manualEvents)[number]) => automaticAppearance.some((item) => item.id === event.id) ? event.evidence : manualEventLabel(event.type);
    const extras: ResultBonusExtra[] = [];
    const addDynamic = (key: ResultBonusDynamic, id: string, date: string, label: string, source: string) => {
      const rule = rules[key];
      if (level && rule.mode === "AMOUNT") extras.push({ id, date, label, source, amount: rule.amount });
    };

    const days: ResultBonusDay[] = workSchedules.map((entry) => {
      const date = dayKey(entry.date);
      const leave = personLeaves.find((item) => date >= dayKey(item.start_date) && date <= dayKey(item.end_date));
      if (leave) return { date, state: "NEUTRAL" as const, reasons: [leave.type === "MALATTIA" ? "Malattia giustificata" : leave.type.toLowerCase()] };
      if (date > today) return { date, state: "PENDING" as const, reasons: ["Turno programmato"] };
      const dayLogs = logsByDay.get(date) ?? [];
      const entryLog = dayLogs.find((log) => log.type === "ENTRATA");
      if (!entryLog) {
        if (date < today) addDynamic("ABSENCE", `absence:${person.id}:${date}`, date, "Assenza senza timbratura", "Presenze");
        return date === today
          ? { date, state: "PENDING" as const, reasons: ["In attesa della timbratura"] }
          : { date, state: "ZERO" as const, reasons: ["Assenza senza timbratura"] };
      }
      const reasons: string[] = [];
      const expectedStart = clockMinutes(entry.start_time ?? entry.category.start_time);
      const late = expectedStart === null ? 0 : Math.max(0, romeMinutes(entryLog.timestamp) - expectedStart);
      if (late > 0) reasons.push(`Ingresso in ritardo di ${late} min`);
      const locationId = entry.location_id ?? entryLog.location_id ?? person.sede_id ?? "";
      const breakLimit = parseClockRule(clockSettings.find((setting) => setting.key === clockRuleKey(locationId))?.value).breakDurationMinutes;
      const breakLate = breakDelayMinutes(dayLogs, breakLimit);
      if (breakLate > 0) reasons.push(`Rientro pausa in ritardo di ${breakLate} min`);
      const zeroManual = manualEvents.filter((event) => event.date === date && resultBonusEventEffect(event.type, level, rules).kind === "ZERO_DAY");
      const flaggedManual = manualEvents.filter((event) => event.date === date && ["APPEARANCE", "REWORK_OPERATOR", "NEGATIVE_REVIEW"].includes(event.type));
      reasons.push(...flaggedManual.map(eventLabel));
      const correctionAccepted = state.disputes.some((item) => item.userId === person.id && item.targetId === `day:${person.id}:${date}` && item.status === "ACCEPTED");
      if (correctionAccepted) {
        return { date, state: date === today ? "IN_PROGRESS" as const : "CONFORMING" as const, reasons: ["Correzione accolta dalla direzione"] };
      }
      if (late > 0) addDynamic("LATE_ENTRY", `late-entry:${person.id}:${date}`, date, `Ingresso in ritardo di ${late} min`, "Timbratura");
      if (breakLate > 0) addDynamic("LATE_BREAK", `late-break:${person.id}:${date}`, date, `Rientro pausa in ritardo di ${breakLate} min`, "Timbratura");
      const zeroDay = (late > 0 && rules.LATE_ENTRY.mode === "ZERO_DAY") || (breakLate > 0 && rules.LATE_BREAK.mode === "ZERO_DAY") || zeroManual.length > 0;
      return {
        date,
        state: zeroDay ? "ZERO" as const : reasons.length ? "ADJUSTED" as const : date === today ? "IN_PROGRESS" as const : "CONFORMING" as const,
        reasons: reasons.length ? reasons : [date === today ? "Controlli in corso" : "Presenza e controlli conformi"],
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    const personResponses = validResponses.filter((response) => {
      const answers = response.answers as Record<string, unknown>;
      const selected = names(answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
      const fallback = names(answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
      const attributed = (selected.length ? selected : fallback).map((name) => resolveCanonicalStaffName(name, allNames));
      return attributed.includes(person.name);
    });
    const appointmentsByDay = new Map<string, number>();
    personResponses.forEach((response) => {
      const date = romeDayKey(response.created_at);
      appointmentsByDay.set(date, (appointmentsByDay.get(date) ?? 0) + 1);
    });

    if (level && level !== "JUNIOR") {
      for (const [date, count] of appointmentsByDay) {
        for (let index = 0; index < Math.max(0, count - 5); index += 1) {
          addDynamic("EXTRA_APPOINTMENT", `appointment:${person.id}:${date}:${index}`, date, "Appuntamento oltre il 5°", "Controllo cliente");
        }
      }
    }

    const nonWorkByDay = new Map(personSchedules.filter((entry) => !isWorkCategory(entry.category)).map((entry) => [dayKey(entry.date), entry]));
    for (const [date, dayLogs] of logsByDay) {
      if (level && nonWorkByDay.has(date) && dayLogs.some((log) => log.type === "ENTRATA")) {
        addDynamic("OFF_SHIFT", `off-shift:${person.id}:${date}`, date, "Turno coperto nel giorno di riposo", "Timbratura");
      }
    }
    for (const event of manualEvents) {
      if (event.type === "PERSONAL_BONUS") {
        if (level && Number.isFinite(event.amount) && (event.amount ?? 0) > 0) extras.push({ id: event.id, date: event.date, label: `Premio individuale: ${event.evidence}`, amount: event.amount!, source: event.actorName });
        continue;
      }
      const effect = resultBonusEventEffect(event.type, level, rules);
      if (level && effect.kind === "BONUS") {
        extras.push({ id: event.id, date: event.date, label: eventLabel(event), amount: effect.amount, source: event.actorName });
      }
    }
    const personTableRows = tableOccurrences.filter((row) => row.userId === person.id);
    for (const row of personTableRows) {
      addDynamic("TABLE_PREVIOUS_STAFF", row.id, row.date, `Sistemazione fasce · app. precedente · ${row.reference}`, "Tabelle");
    }
    if (level && finalized && !manualEvents.some((event) => event.type === "REWORK_OPERATOR")) {
      addDynamic("ZERO_REWORK", `zero-rework:${person.id}:${month}`, `${month}-${String(new Date(end.getTime() - 86_400_000).getUTCDate()).padStart(2, "0")}`, "Zero rilavorazioni imputabili nel mese", "Verifica automatica");
    }

    const disciplinaryDocs = documents.filter((document) => document.user_id === person.id && /LETTER.*CONTESTAZIONE|CONTESTAZIONE.*DISCIPLINARE/i.test(`${document.type} ${document.title}`));
    const calculation = calculateResultBonus({ level, dailyValues: state.dailyValues, days, extras, disciplinaryLetter: disciplinaryDocs.length > 0, finalized });
    const timeline = [
      ...days.map((day) => ({
        id: `day:${person.id}:${day.date}`,
        date: day.date,
        kind: day.state,
        label: day.state === "ZERO" ? "Giornata a 0 €" : day.state === "ADJUSTED" ? "Giornata con segnalazioni" : day.state === "NEUTRAL" ? "Giornata neutra" : day.state === "PENDING" ? "Giornata programmata" : "Giornata conforme",
        detail: day.reasons.join(" · "),
        amount: day.state === "CONFORMING" || day.state === "IN_PROGRESS" || day.state === "ADJUSTED" ? calculation.dailyValue : 0,
        contestable: day.state === "ZERO" && (Date.now() - new Date(`${day.date}T12:00:00+02:00`).getTime()) <= 3 * 86_400_000,
      })),
      ...extras.map((event) => ({ id: event.id, date: event.date, kind: "BONUS", label: event.label, detail: `Registrato da ${event.source}`, amount: event.amount, contestable: false })),
      ...manualEvents.filter((event) => event.type !== "PERSONAL_BONUS" && resultBonusEventEffect(event.type, level, rules).kind === "TRACK_ONLY").map((event) => ({ id: event.id, date: event.date, kind: "TRACK_ONLY", label: eventLabel(event), detail: `${event.evidence} · ${event.actorName} · Solo segnalazione`, amount: 0, contestable: false })),
      ...(rules.TABLE_PREVIOUS_STAFF.mode === "TRACK_ONLY" ? personTableRows.map((row) => ({ id: row.id, date: row.date, kind: "TRACK_ONLY", label: "Sistemazione fasce · app. precedente", detail: `${row.reference} · Solo segnalazione`, amount: 0, contestable: false })) : []),
      ...disciplinaryDocs.map((document) => ({ id: `document:${document.id}`, date: dayKey(document.document_date ?? document.created_at), kind: "MONTH_ZERO", label: "Premio mensile azzerato", detail: document.title, amount: 0, contestable: false })),
    ].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    return {
      id: person.id,
      name: person.name,
      role: person.mansione || "Parrucchiere/a",
      locationName: person.location?.name || "Salone Buenos Aires",
      photoUrl: person.photo_url,
      level,
      levelLabel: level ? RESULT_BONUS_LEVELS[level].label : "Livello da assegnare",
      days,
      extras,
      appointmentsByDay: Object.fromEntries(appointmentsByDay),
      calculation,
      disciplinaryLetter: disciplinaryDocs.length > 0,
      timeline,
      disputes: state.disputes.filter((item) => item.userId === person.id),
      acknowledgement: state.acknowledgements[person.id] ?? null,
    };
  });

  return {
    month,
    monthLabel: new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(start),
    year,
    monthNumber,
    today,
    finalized,
    revision: state.revision,
    actor: { id: actor.id, name: actor.name, role: actor.role },
    canManage,
    isDirection: isDirection(actor.role),
    people: reports,
    allBuenosAiresStaff: people.map((person) => ({ id: person.id, name: person.name, level: state.configs[person.id]?.level ?? null })),
    eventTypes: [
      { value: "APPEARANCE", label: "Richiamo presentabilità", effect: "Giornata a 0 €" },
      { value: "REWORK_OPERATOR", label: "Rilavorazione imputabile all’operatrice", effect: "Giornata a 0 €" },
      { value: "REWORK_CLIENT", label: "Rilavorazione: preferenza cliente", effect: "Solo tracciamento" },
      { value: "REWORK_PRODUCT", label: "Rilavorazione: prodotto", effect: "Solo tracciamento" },
      { value: "NEGATIVE_REVIEW", label: "Recensione negativa nominativa verificata", effect: "Giornata a 0 €" },
      { value: "POSITIVE_REVIEW", label: "Recensione positiva nominativa oltre la 20ª", effect: "+2 €" },
      { value: "URGENT_AVAILABILITY", label: "Reperibilità urgenza confermata", effect: "+5 €" },
      { value: "TRAINING", label: "Corso seguito (solo Junior)", effect: "+10 €" },
    ].map((event) => ({ ...event, effect: resultBonusRuleLabel(rules[event.value as ResultBonusDynamic]) })),
  };
}

export function mayManageResultBonus(actor: AccessActor) {
  return actor.active && isDirection(actor.role);
}

export function mayConfigureResultBonus(actor: AccessActor) {
  return actor.active && isDirection(actor.role);
}

export function isBuenosAiresActor(locationName: string | null | undefined) {
  return belongsToBuenosAires(locationName);
}
