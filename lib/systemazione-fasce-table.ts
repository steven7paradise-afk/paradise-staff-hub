import type { Prisma } from "@prisma/client";
import {
  ASSISTANCE_TABLES_KEY,
  normalizeAssistanceSheets,
  type AssistanceAttachment,
  type AssistanceCellValue,
  type AssistanceSheet,
  type AssistanceTableColumn,
  type AssistanceTableRow,
} from "@/lib/assistance-tables";
import { CLIENT_CONTROL_FIELD_IDS, isClientControlFormName } from "@/lib/client-control-form";
import { prisma } from "@/lib/prisma";

const SYSTEMAZIONE_SHEET_NAME = "sistemazione fasce";
const ORDER_COLUMN_LABEL = "Numero ordine";
const AUTO_ROW_PREFIX = "sistemazione-fasce:";
const VERIFY_PREVIOUS_STAFF_LABEL = "Da verificare";

export type SystemazioneFasceAppointment = {
  id: string | number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  serviceTitle: string;
  shopifyOrderId: string | null;
  bookingStr: string | null;
  startDate: string;
  teammates: Array<{ name: string }>;
  notesText: string | null;
  isCanceled: boolean;
};

export type PreviousClientControl = {
  id: string;
  createdAt: Date | string;
  answers: Record<string, unknown>;
};

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedOrder(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("it")
    .replace(/^ordine\s*/i, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function normalizedPhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").replace(/^39(?=\d{9,10}$)/, "");
}

function namesFromAnswer(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values
    .flatMap((item) => String(item ?? "").split(/[,;]+/))
    .map((item) => item.trim())
    .filter(Boolean))];
}

function answerServices(answers: Record<string, unknown>) {
  const raw = [
    answers.client_control_service_title,
    answers.custom_services,
  ].flatMap((value) => Array.isArray(value) ? value : [value]);
  return normalized(raw.filter(Boolean).join(" "));
}

function isApplicationResponse(answers: Record<string, unknown>) {
  const services = answerServices(answers);
  return /\briapplicazione\b|\bapplicazione\b/.test(services)
    && !/\bsistemazione\s+fasc(?:e|ia|ie)\b/.test(services);
}

function isUsableResponse(answers: Record<string, unknown>) {
  const status = normalized(answers[CLIENT_CONTROL_FIELD_IDS.correctness]);
  return answers.client_control_is_draft !== true
    && status !== "errore"
    && status !== "no show";
}

function isUsablePreviousResponse(answers: Record<string, unknown>) {
  return isUsableResponse(answers) && isApplicationResponse(answers);
}

function isSystemazioneResponse(answers: Record<string, unknown>) {
  return /\bsistemazione\s+fasc(?:e|ia|ie)\b/.test(answerServices(answers));
}

function romeDateKey(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function responseMatchesAppointment(
  answers: Record<string, unknown>,
  appointment: SystemazioneFasceAppointment,
) {
  const appointmentOrder = normalizedOrder(appointment.bookingStr || appointment.shopifyOrderId);
  const responseOrder = normalizedOrder(answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder]);
  if (appointmentOrder && responseOrder && appointmentOrder === responseOrder) return true;

  const appointmentEmail = normalized(appointment.customerEmail);
  const responseEmail = normalized(answers[CLIENT_CONTROL_FIELD_IDS.email]);
  if (appointmentEmail && responseEmail && appointmentEmail === responseEmail) return true;

  const appointmentPhone = normalizedPhone(appointment.customerPhone);
  const responsePhone = normalizedPhone(answers[CLIENT_CONTROL_FIELD_IDS.phone]);
  if (appointmentPhone && responsePhone && appointmentPhone === responsePhone) return true;

  const appointmentName = normalized(appointment.customerName);
  const responseName = normalized(answers[CLIENT_CONTROL_FIELD_IDS.clientName]);
  return Boolean(appointmentName && responseName && appointmentName === responseName);
}

export function isSystemazioneFasceAppointment(serviceTitle: unknown) {
  return /\bsistemazione\s+fasc(?:e|ia|ie)\b/.test(normalized(serviceTitle));
}

export function findPreviousApplication(
  appointment: SystemazioneFasceAppointment,
  responses: PreviousClientControl[],
) {
  const appointmentTime = new Date(appointment.startDate).getTime();
  return responses
    .filter((response) => {
      const responseTime = new Date(response.createdAt).getTime();
      return Number.isFinite(responseTime)
        && responseTime < appointmentTime
        && isUsablePreviousResponse(response.answers)
        && responseMatchesAppointment(response.answers, appointment);
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
}

export function previousApplicationStaff(response: PreviousClientControl | null) {
  if (!response) return "";
  const selected = namesFromAnswer(response.answers[CLIENT_CONTROL_FIELD_IDS.serviceStaff]);
  const fallback = namesFromAnswer(response.answers[CLIENT_CONTROL_FIELD_IDS.serviceOwner]);
  return (selected.length ? selected : fallback).join(", ");
}

export function findSystemazioneControl(
  appointment: SystemazioneFasceAppointment,
  responses: PreviousClientControl[],
) {
  const appointmentTime = new Date(appointment.startDate).getTime();
  const appointmentDay = romeDateKey(appointment.startDate);
  return responses
    .filter((response) => {
      const answers = response.answers;
      const responseTime = new Date(response.createdAt).getTime();
      const exactBooking = String(answers.booking_id ?? "").trim() === String(appointment.id);
      const sameDay = Number.isFinite(responseTime) && romeDateKey(response.createdAt) === appointmentDay;
      return isUsableResponse(answers)
        && isSystemazioneResponse(answers)
        && responseMatchesAppointment(answers, appointment)
        && (exactBooking || sameDay);
    })
    .sort((left, right) => {
      const leftExact = String(left.answers.booking_id ?? "").trim() === String(appointment.id);
      const rightExact = String(right.answers.booking_id ?? "").trim() === String(appointment.id);
      if (leftExact !== rightExact) return leftExact ? -1 : 1;
      return Math.abs(new Date(left.createdAt).getTime() - appointmentTime)
        - Math.abs(new Date(right.createdAt).getTime() - appointmentTime);
    })[0] ?? null;
}

function attachmentFromAnswer(value: unknown): AssistanceAttachment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const url = String(data.url || data.driveFileUrl || data.webContentLink || data.webViewLink || "").trim();
  if (!url) return null;
  return {
    name: String(data.name || "Foto cliente").trim() || "Foto cliente",
    url,
    type: String(data.type || "image/jpeg"),
  };
}

function columnByLabel(sheet: AssistanceSheet, matcher: RegExp) {
  return sheet.columns.find((column) => matcher.test(normalized(column.label)));
}

function textCell(row: AssistanceTableRow, column?: AssistanceTableColumn) {
  if (!column) return "";
  const value = row.values[column.id];
  return typeof value === "string" ? value.trim() : "";
}

function setTextIfBlank(
  values: Record<string, AssistanceCellValue>,
  column: AssistanceTableColumn | undefined,
  value: string,
) {
  if (!column || !value) return;
  const currentValue = values[column.id];
  if (typeof currentValue === "string" && currentValue.trim()) return;
  values[column.id] = value;
}

function updateAutoValue(
  values: Record<string, AssistanceCellValue>,
  column: AssistanceTableColumn | undefined,
  value: string,
) {
  if (!column || !value) return;
  values[column.id] = value;
}

export function applySystemazioneAppointmentsToSheet({
  sheet,
  appointments,
  responses,
  now = new Date().toISOString(),
}: {
  sheet: AssistanceSheet;
  appointments: SystemazioneFasceAppointment[];
  responses: PreviousClientControl[];
  now?: string;
}) {
  const orderColumn = columnByLabel(sheet, /^(numero )?ordine( shopify)?$/)
    ?? { id: crypto.randomUUID(), label: ORDER_COLUMN_LABEL, type: "text" as const };
  const columns = sheet.columns.some((column) => column.id === orderColumn.id)
    ? sheet.columns
    : [...sheet.columns, orderColumn];
  const workingSheet = { ...sheet, columns };

  const clientColumn = columnByLabel(workingSheet, /^nome cliente$/);
  const phoneColumn = columnByLabel(workingSheet, /^telefono$/);
  const photoColumn = columnByLabel(workingSheet, /^foto$/);
  const notesColumn = columnByLabel(workingSheet, /^note?$/);
  const emailColumn = columnByLabel(workingSheet, /^e ?mail$/);
  const previousColumn = columnByLabel(workingSheet, /^app(?:untamento)? precedente$/);
  const systemazioneColumn = columnByLabel(workingSheet, /^sistemazione$/);

  const columnsChanged = columns !== sheet.columns;
  let rows = [...sheet.rows];

  for (const appointment of appointments) {
    if (appointment.isCanceled || !isSystemazioneFasceAppointment(appointment.serviceTitle)) continue;

    const rowId = `${AUTO_ROW_PREFIX}${appointment.id}`;
    const appointmentOrder = (appointment.bookingStr || appointment.shopifyOrderId || "").trim();
    const previous = findPreviousApplication(appointment, responses);
    const systemazioneControl = findSystemazioneControl(appointment, responses);
    const order = (
      appointmentOrder
      || String(systemazioneControl?.answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] ?? "")
      || String(previous?.answers[CLIENT_CONTROL_FIELD_IDS.shopifyOrder] ?? "")
    ).trim();
    const cleanOrder = normalizedOrder(order);
    const cleanName = normalized(appointment.customerName);
    const cleanPhone = normalizedPhone(appointment.customerPhone);
    const cleanEmail = normalized(appointment.customerEmail);
    let rowIndex = rows.findIndex((row) => row.id === rowId);

    if (rowIndex < 0 && cleanOrder) {
      rowIndex = rows.findIndex((row) => normalizedOrder(textCell(row, orderColumn)) === cleanOrder);
    }

    if (rowIndex < 0) {
      rowIndex = rows.findIndex((row) => {
        if (textCell(row, orderColumn)) return false;
        if (cleanName && normalized(textCell(row, clientColumn)) !== cleanName) return false;
        const samePhone = cleanPhone && normalizedPhone(textCell(row, phoneColumn)) === cleanPhone;
        const sameEmail = cleanEmail && normalized(textCell(row, emailColumn)) === cleanEmail;
        return Boolean(cleanName && (samePhone || sameEmail));
      });
    }

    const previousStaff = previousApplicationStaff(previous);
    // "Sistemazione" indica chi ha dichiarato di aver svolto il servizio nel
    // Controllo Cliente completato, non chi era soltanto assegnato in agenda.
    const currentStaff = previousApplicationStaff(systemazioneControl);
    const previousPhoto = attachmentFromAnswer(
      systemazioneControl?.answers[CLIENT_CONTROL_FIELD_IDS.clientPhoto]
      ?? previous?.answers[CLIENT_CONTROL_FIELD_IDS.clientPhoto],
    );
    const existing = rowIndex >= 0 ? rows[rowIndex] : null;
    const values = { ...(existing?.values ?? {}) };

    setTextIfBlank(values, clientColumn, appointment.customerName.trim());
    setTextIfBlank(values, phoneColumn, appointment.customerPhone?.trim() || "");
    setTextIfBlank(values, emailColumn, appointment.customerEmail?.trim() || "");
    setTextIfBlank(values, notesColumn, appointment.notesText?.trim().slice(0, 1200) || "");
    setTextIfBlank(values, orderColumn, order);
    if (previousStaff) updateAutoValue(values, previousColumn, previousStaff);
    else setTextIfBlank(values, previousColumn, VERIFY_PREVIOUS_STAFF_LABEL);
    if (currentStaff) updateAutoValue(values, systemazioneColumn, currentStaff);
    else if (!existing || existing.id.startsWith(AUTO_ROW_PREFIX)) {
      setTextIfBlank(values, systemazioneColumn, VERIFY_PREVIOUS_STAFF_LABEL);
    }
    if (photoColumn && previousPhoto && !values[photoColumn.id]) values[photoColumn.id] = previousPhoto;

    const nextRow: AssistanceTableRow = {
      id: existing?.id ?? rowId,
      nome: existing?.nome ?? "",
      cognome: existing?.cognome ?? "",
      testo: existing?.testo ?? "",
      image: existing?.image ?? null,
      file: existing?.file ?? null,
      values,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const rowChanged = !existing || JSON.stringify(existing.values) !== JSON.stringify(values);
    if (rowChanged && existing) rows[rowIndex] = nextRow;
    else if (!existing) rows = [nextRow, ...rows];
  }

  const originalRows = new Map(sheet.rows.map((row) => [row.id, row]));
  let createdRows = 0;
  let updatedRows = 0;
  rows = rows.map((row) => {
    const original = originalRows.get(row.id);
    if (!original) {
      createdRows += 1;
      return row;
    }
    if (JSON.stringify(original.values) === JSON.stringify(row.values)) return original;
    updatedRows += 1;
    return row;
  });
  const changed = columnsChanged || createdRows > 0 || updatedRows > 0;

  return {
    changed,
    createdRows,
    updatedRows,
    sheet: changed ? { ...workingSheet, rows, updatedAt: now } : sheet,
  };
}

export async function syncSystemazioneFasceTable(appointments: SystemazioneFasceAppointment[]) {
  const targets = appointments.filter((appointment) => (
    !appointment.isCanceled && isSystemazioneFasceAppointment(appointment.serviceTitle)
  ));
  if (!targets.length) return { createdRows: 0, updatedRows: 0 };

  const [tableSetting, forms] = await Promise.all([
    prisma.setting.findUnique({ where: { key: ASSISTANCE_TABLES_KEY } }),
    prisma.serviceForm.findMany({ select: { id: true, name: true, category: true } }),
  ]);
  const sheets = normalizeAssistanceSheets(tableSetting?.value);
  const sheetIndex = sheets.findIndex((sheet) => normalized(sheet.name) === SYSTEMAZIONE_SHEET_NAME);
  if (sheetIndex < 0) return { createdRows: 0, updatedRows: 0 };

  const formIds = forms
    .filter((form) => isClientControlFormName(form.name, form.category))
    .map((form) => form.id);
  const rawResponses = formIds.length
    ? await prisma.serviceFormResponse.findMany({
        where: {
          form_id: { in: formIds },
        },
        select: { id: true, created_at: true, answers: true },
        orderBy: { created_at: "desc" },
        take: 3000,
      })
    : [];
  const responses: PreviousClientControl[] = rawResponses.map((response) => ({
    id: response.id,
    createdAt: response.created_at,
    answers: response.answers as Record<string, unknown>,
  }));
  const result = applySystemazioneAppointmentsToSheet({
    sheet: sheets[sheetIndex],
    appointments: targets,
    responses,
  });
  if (!result.changed) return { createdRows: 0, updatedRows: 0 };

  const nextSheets = [...sheets];
  nextSheets[sheetIndex] = result.sheet;
  await prisma.setting.upsert({
    where: { key: ASSISTANCE_TABLES_KEY },
    create: { key: ASSISTANCE_TABLES_KEY, value: nextSheets as unknown as Prisma.InputJsonValue },
    update: { value: nextSheets as unknown as Prisma.InputJsonValue },
  });
  return { createdRows: result.createdRows, updatedRows: result.updatedRows };
}
