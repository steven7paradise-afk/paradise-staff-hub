import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cashDateFromInput } from "@/lib/cash-records";
import { uploadCashReceiptToGoogleDrive } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.formData().catch(() => null);
  const locationId = String(body?.get("locationId") ?? "").trim();
  const date = String(body?.get("date") ?? "").trim();
  const amount = Number(String(body?.get("amount") ?? "").replace(",", "."));
  const reason = String(body?.get("reason") ?? "").trim();
  const receipt = body?.get("receipt");

  if (!locationId || !date || !Number.isFinite(amount) || amount <= 0 || !reason) {
    return NextResponse.json({ error: "Salone, data, importo e motivo sono obbligatori." }, { status: 400 });
  }
  if (!(receipt instanceof File) || !receipt.type.startsWith("image/") || receipt.size > MAX_RECEIPT_SIZE) {
    return NextResponse.json({ error: "La foto dello scontrino è obbligatoria e deve pesare al massimo 10 MB." }, { status: 400 });
  }

  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true },
  });
  const hasFullCashAccess = accessUser ? await canAccessForUser(prisma, "/cash", accessUser) : false;

  if (session.user.role === "RESPONSABILE" && session.user.sedeId && locationId !== session.user.sedeId && !hasFullCashAccess) {
    return NextResponse.json({ error: "Puoi registrare prelievi solo per il tuo salone." }, { status: 403 });
  }

  const location = await prisma.location.findFirst({ where: { id: locationId, active: true } });

  if (!location) {
    return NextResponse.json({ error: "Salone non valido." }, { status: 400 });
  }

  const accountingDate = cashDateFromInput(date);
  if (!accountingDate) {
    return NextResponse.json({ error: "Data prelievo non valida." }, { status: 400 });
  }

  const receiptBuffer = Buffer.from(await receipt.arrayBuffer());
  const receiptFileName = cashReceiptFileName(receipt.name, accountingDate, location.name, reason);
  const driveReceipt = await uploadCashReceiptToGoogleDrive(receiptBuffer, receiptFileName, receipt.type);
  const response = await prisma.cashVaultWithdrawal.create({
    data: {
      user_id: session.user.id,
      location_id: location.id,
      date: accountingDate,
      amount,
      reason,
      receipt_path: `drive:${driveReceipt.id}`,
      receipt_name: driveReceipt.name || receiptFileName,
      signature_name: session.user.name ?? "Admin",
      signature_role: session.user.role,
      signed_at: new Date(),
    },
    include: { user: true, location: true },
  });

  return NextResponse.json({ response });
}

function cashReceiptFileName(originalName: string, date: Date, locationName: string, reason: string) {
  const extension = safeExtension(originalName);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const cleanLocation = safeFilePart(locationName || "Sede");
  const cleanReason = safeFilePart(reason || "Spesa").slice(0, 50);
  return `${year}-${month}-${day}-${cleanLocation}-${cleanReason}.${extension}`;
}

function safeExtension(name: string) {
  const extension = String(name || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!extension || extension.length > 5) return "jpg";
  return extension;
}

function safeFilePart(value: string) {
  return String(value || "")
    .trim()
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^-+|-+$/g, "") || "Spesa";
}
