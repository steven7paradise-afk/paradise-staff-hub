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
