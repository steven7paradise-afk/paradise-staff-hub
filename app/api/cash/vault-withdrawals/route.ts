import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cashDateFromInput } from "@/lib/cash-records";
import { prisma } from "@/lib/prisma";
import { uploadCashReceipt } from "@/lib/supabase-storage";

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  const isDarwin = session?.user?.id === "cmpms4o9h0003l809zof30mni" || !!session?.user?.email?.toLowerCase().includes("darwin");
  if (!session?.user?.id || (!["SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(session.user.role ?? "") && !isDarwin)) {
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

  if (session.user.role === "RESPONSABILE" && session.user.sedeId && locationId !== session.user.sedeId && !isDarwin) {
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

  const receiptPath = await uploadCashReceipt(session.user.id, receipt);
  const response = await prisma.cashVaultWithdrawal.create({
    data: {
      user_id: session.user.id,
      location_id: location.id,
      date: accountingDate,
      amount,
      reason,
      receipt_path: receiptPath,
      receipt_name: receipt.name,
      signature_name: session.user.name ?? "Admin",
      signature_role: session.user.role,
      signed_at: new Date(),
    },
    include: { user: true, location: true },
  });

  return NextResponse.json({ response });
}
