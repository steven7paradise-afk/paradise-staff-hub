import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { downloadGoogleDriveFile, getGoogleDriveFileId } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";

function safeFileName(value: string) {
  return value.replace(/[\r\n"\\]/g, "_");
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await context.params;
  const notification = await prisma.notification.findFirst({
    where: { id, user_id: session.user.id, type: "COMUNICAZIONE" },
    select: { action_url: true, message: true },
  });
  if (!notification?.action_url) {
    return NextResponse.json({ error: "Allegato non trovato" }, { status: 404 });
  }

  const driveId = getGoogleDriveFileId(notification.action_url) || getGoogleDriveFileId(notification.message);
  if (!driveId) {
    try {
      const url = new URL(notification.action_url);
      if (url.protocol !== "https:") throw new Error("Protocollo non consentito");
      return NextResponse.redirect(url);
    } catch {
      return NextResponse.json({ error: "Link allegato non valido" }, { status: 400 });
    }
  }

  try {
    const file = await downloadGoogleDriveFile(driveId);
    return new NextResponse(file.buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${safeFileName(file.name)}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to open communication attachment:", error);
    return NextResponse.json({ error: "Allegato non disponibile. Riprova tra poco." }, { status: 503 });
  }
}
