import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { downloadGoogleDriveFile } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { downloadPrivateDocument } from "@/lib/supabase-storage";

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
    select: { receipt_path: true, receipt_name: true, location_id: true },
  });

  if (!withdrawal?.receipt_path) {
    return NextResponse.json({ error: "Scontrino non trovato" }, { status: 404 });
  }
  const accessUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, access_list: true },
  });
  const hasFullCashAccess = isDarwin || (accessUser ? await canAccessForUser(prisma, "/cash", accessUser) : false);

  if (session.user.role === "RESPONSABILE" && session.user.sedeId && withdrawal.location_id !== session.user.sedeId && !hasFullCashAccess) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const driveFileId = googleDriveReceiptId(withdrawal.receipt_path);
  if (driveFileId) {
    const driveFile = await downloadGoogleDriveFile(driveFileId);
    return new NextResponse(driveFile.buffer, {
      headers: {
        "Content-Type": driveFile.mimeType || contentTypeFromName(driveFile.name),
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `inline; filename="${safeReceiptName(driveFile.name || withdrawal.receipt_name || "scontrino")}"`,
      },
    });
  }

  const file = await downloadPrivateDocument(withdrawal.receipt_path);
  const contentType = file.type || contentTypeFromName(withdrawal.receipt_name || withdrawal.receipt_path);
  const bytes = await file.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="${safeReceiptName(withdrawal.receipt_name || "scontrino")}"`,
    },
  });
}

function contentTypeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function safeReceiptName(name: string) {
  return name.replace(/["\r\n]/g, "").trim() || "scontrino";
}

function googleDriveReceiptId(value: string) {
  if (value.startsWith("drive:")) return value.slice("drive:".length).trim();
  return "";
}
