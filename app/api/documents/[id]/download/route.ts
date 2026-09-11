import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadPrivateDocument } from "@/lib/supabase-storage";
import { downloadGoogleDriveFile, getGoogleDriveFileId } from "@/lib/google-drive";

const managerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await context.params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || (document.user_id !== session.user.id && !managerRoles.has(session.user.role))) {
    return NextResponse.json({ error: "Documento non disponibile" }, { status: 404 });
  }
  try {
    const asAttachment = new URL(request.url).searchParams.get("download") === "1";
    const disposition = asAttachment ? "attachment" : "inline";
    if (document.storage_path) {
      const file = await downloadPrivateDocument(document.storage_path);
      const fileName = document.storage_path.split("/").pop() || `${document.title}.pdf`;
      return new NextResponse(await file.arrayBuffer(), {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    const driveFileId = getGoogleDriveFileId(document.file_url);
    if (driveFileId) {
      const file = await downloadGoogleDriveFile(driveFileId);
      return new NextResponse(file.buffer, {
        headers: {
          "Content-Type": file.mimeType,
          "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    return NextResponse.redirect(document.file_url);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Download non riuscito." }, { status: 503 });
  }
}
