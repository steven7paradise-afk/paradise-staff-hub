import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

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

  // 4. Construct answer values
  const dateStr = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
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

  // 5. Append response row
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${targetTabName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [rowValues],
    },
  });

  return { success: true };
}

