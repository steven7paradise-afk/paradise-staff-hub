import { NextRequest, NextResponse } from "next/server";
import { mobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { downloadPrivateDocument } from "@/lib/supabase-storage";
import { downloadGoogleDriveFile, getGoogleDriveFileId } from "@/lib/google-drive";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await mobileUser(request);
  if (!auth) return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  const { id } = await context.params;
  const document = await prisma.document.findFirst({ where: { id, user_id: auth.user.id } });
  if (!document) return NextResponse.json({ error: "Documento non disponibile." }, { status: 404 });

  try {
    if (document.storage_path) {
      const file = await downloadPrivateDocument(document.storage_path);
      const fileName = document.storage_path.split("/").pop() || `${document.title}.pdf`;
      return new NextResponse(await file.arrayBuffer(), {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const driveFileId = getGoogleDriveFileId(document.file_url);
    if (driveFileId) {
      const file = await downloadGoogleDriveFile(driveFileId);
      return new NextResponse(file.buffer, {
        headers: {
          "Content-Type": file.mimeType,
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return NextResponse.redirect(document.file_url);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Download non riuscito." }, { status: 503 });
  }
}
