import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadSocialCoverToGoogleDrive } from "@/lib/google-drive";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  // Authorize: role or job title
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, mansione: true }
  });

  const isAllowed =
    user?.role === "ZERO" || user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "RESPONSABILE" ||
    (user?.mansione && user.mansione.toLowerCase().includes("social"));

  if (!isAllowed) {
    return NextResponse.json({ error: "Accesso negato. Permessi insufficienti." }, { status: 403 });
  }

  try {
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Carica una foto JPG, PNG, WebP o GIF fino a 10 MB." }, { status: 400 });
    }

    const extension = {"image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/gif":"gif"}[file.type];
    const uploaded = await uploadSocialCoverToGoogleDrive(
      Buffer.from(await file.arrayBuffer()),
      `social-${session.user.id}-${randomUUID()}.${extension}`,
      file.type,
    );
    return NextResponse.json({ coverUrl: uploaded.photoUrl, driveFileId: uploaded.id });
  } catch (error) {
    console.error("Social cover upload to Google Drive failed", error instanceof Error ? error.message : "Unknown error");
    const missingCredentials = error instanceof Error && error.message === "Google credentials are not configured";
    return NextResponse.json({ error: missingCredentials
      ? "Google Drive non è configurato su questo server. L’amministratore deve collegare l’account Google e la cartella Social Calendar."
      : "Caricamento su Google Drive non riuscito. Riprova tra poco o verifica la cartella e i permessi Drive." }, { status: missingCredentials ? 503 : 500 });
  }
}
