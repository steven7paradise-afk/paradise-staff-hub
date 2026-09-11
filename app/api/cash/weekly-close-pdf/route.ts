import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadCashClosingPdfToGoogleDrive } from "@/lib/google-drive";

function cleanFilePart(value: string) {
  return String(value || "")
    .trim()
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const locationId = String(body?.locationId ?? "").trim();
  const weekKey = String(body?.weekKey ?? "").trim();
  const monthLabel = cleanFilePart(String(body?.monthLabel ?? ""));
  const locationName = cleanFilePart(String(body?.locationName ?? "Salone"));
  const pdfBase64 = String(body?.pdfBase64 ?? "");

  if (!locationId || !weekKey || !monthLabel || !pdfBase64) {
    return NextResponse.json({ error: "Dati PDF mancanti." }, { status: 400 });
  }

  const base64 = pdfBase64.includes(",") ? pdfBase64.split(",").at(-1) || "" : pdfBase64;
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) {
    return NextResponse.json({ error: "PDF non valido." }, { status: 400 });
  }

  const fileName = `Chiusura ${monthLabel} - ${locationName}.pdf`;
  const driveFile = await uploadCashClosingPdfToGoogleDrive(buffer, fileName, monthLabel);

  const settingKey = `cash_week_close:${locationId}:${weekKey}`;
  const existing = await prisma.setting.findUnique({ where: { key: settingKey } }).catch(() => null);
  if (existing?.value && typeof existing.value === "object" && !Array.isArray(existing.value)) {
    await prisma.setting.update({
      where: { key: settingKey },
      data: {
        value: {
          ...(existing.value as Record<string, unknown>),
          pdf_drive: driveFile,
          pdf_uploaded_at: new Date().toISOString(),
        },
      },
    });
  }

  return NextResponse.json({ success: true, file: driveFile });
}
