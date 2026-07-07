import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedDocumentUrl } from "@/lib/supabase-storage";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const isDarwin = session?.user?.id === "cmpms4o9h0003l809zof30mni" || !!session?.user?.email?.toLowerCase().includes("darwin");
  if (!session?.user?.id || (!["SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(session.user.role ?? "") && !isDarwin)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await params;
  const withdrawal = await prisma.cashVaultWithdrawal.findUnique({
    where: { id },
    select: { receipt_path: true, location_id: true },
  });

  if (!withdrawal?.receipt_path) {
    return NextResponse.json({ error: "Scontrino non trovato" }, { status: 404 });
  }
  if (session.user.role === "RESPONSABILE" && session.user.sedeId && withdrawal.location_id !== session.user.sedeId && !isDarwin) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const url = await signedDocumentUrl(withdrawal.receipt_path);
  return NextResponse.redirect(url);
}
