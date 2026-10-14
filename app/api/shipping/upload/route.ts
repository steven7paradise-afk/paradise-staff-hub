import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditForUser } from "@/lib/roles";
import { uploadFileToGoogleDrive } from "@/lib/google-drive";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, active: true },
  });
  if (!user?.active || !(await canEditForUser(prisma, "/shipping", user))) {
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });
  }

  try {
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/") || file.size === 0) {
      return NextResponse.json({ error: "Seleziona una foto valida." }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "La foto non può superare i 20 MB." }, { status: 400 });
    }
    const result = await uploadFileToGoogleDrive(
      Buffer.from(await file.arrayBuffer()),
      `spedizione_${Date.now()}_${file.name}`,
      file.type,
      { publicRead: false },
    );
    return NextResponse.json({
      url: `https://drive.google.com/file/d/${result.id}/view`,
      name: file.name,
      isImage: true,
    });
  } catch (error) {
    console.error("Failed to upload shipping photo to Google Drive:", error);
    return NextResponse.json({
      error: "Caricamento della foto su Google Drive non riuscito. Riprova tra poco; se il problema continua, contatta l’amministratore.",
    }, { status: 503 });
  }
}
