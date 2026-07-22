import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getWarehouseState } from "@/lib/internal-warehouse";

type AttendanceSheetRow = {
  date: string;
  time: string;
  employeeName: string;
  employeeEmail: string;
  locationName: string;
  type: string;
  deviceName: string;
  note?: string | null;
};

function getPrivateKey() {
  if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }
  return process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export async function appendAttendanceToGoogleSheet(row: AttendanceSheetRow) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!spreadsheetId || !clientEmail || !privateKey) {
    return { skipped: true, reason: "Google Sheet environment not configured" };
  }

  const settings = await prisma.googleSheetSetting.findFirst({
    where: { active: true },
    orderBy: { id: "desc" },
  });

  const sheetName = settings?.sheet_name ?? "Timbrature";
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: settings?.spreadsheet_id ?? spreadsheetId,
    range: `${sheetName}!A:H`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          row.date,
          row.time,
          row.employeeName,
          row.employeeEmail,
          row.locationName,
          row.type,
          row.deviceName,
          row.note ?? "",
        ],
      ],
    },
  });

  if (settings) {
    await prisma.googleSheetSetting.update({
      where: { id: settings.id },
      data: { last_sync_at: new Date() },
    });
  }

  return { skipped: false };
}

type FormField = {
  id: string;
  label: string;
  type: string;
};

type FormSyncInput = {
  formName: string;
  fields: FormField[];
  employeeName: string;
  employeeEmail: string;
  locationName: string;
  answers: Record<string, any>;
};

export async function appendFormResponseToGoogleSheet(input: FormSyncInput) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new Error("Credenziali Google Sheets non configurate nel server.");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  
  // Clean tab name to fit within Google Sheet title limits
  const cleanFormName = input.formName.replace(/[\[\]\*\?\/\\]/g, ""); // Remove invalid sheet characters
  const targetTabName = `Form - ${cleanFormName.slice(0, 20)}`.trim();

  // 1. Check if sheet exists, if not create it
  let sheetNames: string[] = [];
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    sheetNames = spreadsheet.data.sheets?.map((s) => s.properties?.title).filter(Boolean) as string[] || [];
  } catch (err) {
    console.error("Failed to read spreadsheet layout:", err);
    throw new Error("Impossibile connettersi al foglio Google. Verifica che il Service Account sia condiviso come Editor.");
  }

  if (!sheetNames.includes(targetTabName)) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: targetTabName,
                },
              },
            },
          ],
        },
      });
    } catch (createErr) {
      console.error("Failed to dynamically add sheet tab:", createErr);
    }
  }

  // 2. Check if A1 has headers
  let hasHeaders = false;
  try {
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetTabName}!A1:Z1`,
    });
    hasHeaders = !!(readResponse.data.values && readResponse.data.values.length > 0);
  } catch (readErr) {
    console.warn("Failed to check headers, assuming empty:", readErr);
  }

  // 3. Write headers if empty
  if (!hasHeaders) {
    const headerRow = ["Data e Ora", "Dipendente", "Email", "Sede", ...input.fields.map((f) => f.label)];
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${targetTabName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [headerRow],
        },
      });
    } catch (headerErr) {
      console.error("Failed to write form response headers:", headerErr);
    }
  }

  // 4. Construct answer values (handling group participants if applicable)
  const dateStr = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
  
  const isCorsistiForm = input.formName.toUpperCase().includes("CORSISTI");
  const participaField = input.fields.find((f) => f.label.toUpperCase().includes("PARTICIPA"));
  const participaValue = participaField ? input.answers[participaField.id] : "";
  const isGroupCourse = String(participaValue || "").toUpperCase().includes("GRUP");
  const groupCount = parseInt(input.answers["group_participants_count"] || "0", 10);

  const nomeField = input.fields.find((f) => f.label.trim().toUpperCase() === "NOME CORSISTA");
  const emailField = input.fields.find((f) => f.label.trim().toUpperCase() === "EMAIL CORSISTA");
  const numeroField = input.fields.find((f) => f.label.trim().toUpperCase() === "NUMERO CORSISTA");

  const rowsToAppend: any[][] = [];

  if (isCorsistiForm && isGroupCourse && groupCount > 0) {
    for (let pIndex = 1; pIndex <= groupCount; pIndex++) {
      const participantAnswers = { ...input.answers };
      if (nomeField) participantAnswers[nomeField.id] = input.answers[`participant_${pIndex}_name`] || "";
      if (emailField) participantAnswers[emailField.id] = input.answers[`participant_${pIndex}_email`] || "";
      if (numeroField) participantAnswers[numeroField.id] = input.answers[`participant_${pIndex}_phone`] || "";

      const rowValues = [
        dateStr,
        input.employeeName,
        input.employeeEmail,
        input.locationName,
        ...input.fields.map((field) => {
          const answer = participantAnswers[field.id];
          if (answer === undefined || answer === null || answer === "") return "";
          
          if (field.type === "file" && typeof answer === "object") {
            return `File: ${answer.name} [Percorso: ${answer.storagePath}]`;
          }
          
          if (field.type === "money") {
            const val = parseFloat(answer);
            return isNaN(val) ? String(answer) : `€ ${val.toFixed(2)}`;
          }
          
          if (field.type === "date") {
            const parts = String(answer).split("-");
            if (parts.length === 3) {
              return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
          }
          
          return String(answer);
        }),
      ];
      rowsToAppend.push(rowValues);
    }
  } else {
    const rowValues = [
      dateStr,
      input.employeeName,
      input.employeeEmail,
      input.locationName,
      ...input.fields.map((field) => {
        const answer = input.answers[field.id];
        if (answer === undefined || answer === null || answer === "") return "";
        
        if (field.type === "file" && typeof answer === "object") {
          return `File: ${answer.name} [Percorso: ${answer.storagePath}]`;
        }
        
        if (field.type === "money") {
          const val = parseFloat(answer);
          return isNaN(val) ? String(answer) : `€ ${val.toFixed(2)}`;
        }
        
        if (field.type === "date") {
          const parts = String(answer).split("-");
          if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }
        
        return String(answer);
      }),
    ];
    rowsToAppend.push(rowValues);
  }

  // 5. Append response row(s)
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${targetTabName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: rowsToAppend,
    },
  });

  return { success: true };
}

function sheetTitle(title: string) {
  return title.replace(/[\[\]\*\?\/\\]/g, "").slice(0, 90);
}

function sheetRange(title: string, range = "A:E") {
  return `'${sheetTitle(title).replace(/'/g, "''")}'!${range}`;
}

function serializeValue(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === "bigint") return item.toString();
    if (item instanceof Date) return item.toISOString();
    return item;
  });
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function getBackupSheetsClient() {
  const envSpreadsheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!envSpreadsheetId || !clientEmail || !privateKey) {
    throw new Error("Credenziali Google Sheets non configurate nel server.");
  }

  const settings = await prisma.googleSheetSetting.findFirst({
    where: { active: true },
    orderBy: { id: "desc" },
  });

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    spreadsheetId: settings?.spreadsheet_id ?? envSpreadsheetId,
    settingsId: settings?.id,
    sheets: google.sheets({ version: "v4", auth }),
  };
}

async function ensureBackupTabs(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string, titles: string[]) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(spreadsheet.data.sheets?.map((item) => item.properties?.title).filter(Boolean) as string[]);
  const requests = titles
    .map(sheetTitle)
    .filter((title) => !existing.has(title))
    .map((title) => ({ addSheet: { properties: { title } } }));

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }
}

function rowsForBackup(records: unknown[], backupAt: string) {
  return [
    ["id", "backup_at", "created_at", "updated_at", "data_json"],
    ...records.map((record) => {
      const item = asRecord(record);
      return [
        String(item.id ?? item.key ?? item.order_id ?? ""),
        backupAt,
        item.created_at instanceof Date ? item.created_at.toISOString() : String(item.created_at ?? ""),
        item.updated_at instanceof Date ? item.updated_at.toISOString() : String(item.updated_at ?? ""),
        serializeValue(record),
      ];
    }),
  ];
}

export async function backupDatabaseToGoogleSheet() {
  const { sheets, spreadsheetId, settingsId } = await getBackupSheetsClient();
  const backupAt = new Date().toISOString();
  const warehouseState = await getWarehouseState();

  const tables = [
    { tab: "Backup Users", rows: await prisma.user.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup Locations", rows: await prisma.location.findMany({ orderBy: { name: "asc" } }) },
    { tab: "Backup Devices", rows: await prisma.device.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup Attendance", rows: await prisma.attendanceLog.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup LeaveRequests", rows: await prisma.leaveRequest.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup Documents", rows: await prisma.document.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup Notifications", rows: await prisma.notification.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup ScheduleCategories", rows: await prisma.scheduleCategory.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup ScheduleEntries", rows: await prisma.scheduleEntry.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup ScheduleWorkers", rows: await prisma.scheduleWorkerOverride.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup WorkHours", rows: await prisma.workHourRecord.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup ServiceForms", rows: await prisma.serviceForm.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup FormResponses", rows: await prisma.serviceFormResponse.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup CashClosings", rows: await prisma.cashClosing.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup CashWithdrawals", rows: await prisma.cashVaultWithdrawal.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup CashMonths", rows: await prisma.cashMonthClose.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup Settings", rows: await prisma.setting.findMany({ orderBy: { key: "asc" } }) },
    { tab: "Backup Branding", rows: await prisma.brandingSetting.findMany() },
    { tab: "Backup EmailSettings", rows: await prisma.emailSetting.findMany() },
    { tab: "Backup SheetSettings", rows: await prisma.googleSheetSetting.findMany() },
    { tab: "Backup Candidates", rows: await prisma.candidate.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup SocialPosts", rows: await prisma.socialPost.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup OrderCache", rows: await prisma.shopifyOrderCache.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup OrderComments", rows: await prisma.shopifyOrderComment.findMany({ orderBy: { created_at: "asc" } }) },
    { tab: "Backup Warehouse", rows: [{ id: "internal_warehouse_state", created_at: backupAt, updated_at: backupAt, state: warehouseState }] },
  ];

  await ensureBackupTabs(sheets, spreadsheetId, tables.map((table) => table.tab));

  for (const table of tables) {
    const title = sheetTitle(table.tab);
    const values = rowsForBackup(table.rows, backupAt);
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetRange(title, "A:E"),
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sheetRange(title, "A1"),
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }

  if (settingsId) {
    await prisma.googleSheetSetting.update({
      where: { id: settingsId },
      data: { last_sync_at: new Date() },
    });
  }

  return {
    spreadsheetId,
    backupAt,
    tables: tables.map((table) => ({ tab: sheetTitle(table.tab), rows: table.rows.length })),
  };
}
