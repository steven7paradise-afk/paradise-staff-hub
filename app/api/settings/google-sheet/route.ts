import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const setting = await prisma.googleSheetSetting.findFirst({
    orderBy: { id: "desc" },
  });

  return NextResponse.json({
    setting,
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "digital@paradisebeauty.it",
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { spreadsheet_id, sheet_name, active } = await request.json();

  if (!spreadsheet_id) {
    return NextResponse.json({ error: "Lo Spreadsheet ID è obbligatorio" }, { status: 400 });
  }

  const existing = await prisma.googleSheetSetting.findFirst({
    orderBy: { id: "desc" },
  });

  let setting;
  if (existing) {
    setting = await prisma.googleSheetSetting.update({
      where: { id: existing.id },
      data: {
        spreadsheet_id,
        sheet_name: sheet_name || "Timbrature",
        active: Boolean(active),
      },
    });
  } else {
    setting = await prisma.googleSheetSetting.create({
      data: {
        spreadsheet_id,
        sheet_name: sheet_name || "Timbrature",
        active: Boolean(active),
      },
    });
  }

  return NextResponse.json({ setting });
}
