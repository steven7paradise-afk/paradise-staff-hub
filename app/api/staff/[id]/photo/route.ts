import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadStaffPhotoToGoogleDrive } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

function safeFileName(value: string) {
  return value
    .trim()
    .replace(/[\/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !managementRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await context.params;
  const formData = await request.formData();
  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Carica una foto valida." }, { status: 400 });
  }

  const isImage = file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
  if (!isImage || file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "La foto deve essere un'immagine fino a 15 MB." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id, role: { not: "SUPER_ADMIN" } },
    select: { id: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Lavoratore non trovato." }, { status: 404 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${safeFileName(user.name)}-profilo-${Date.now()}.${extension}`;
    const driveFile = await uploadStaffPhotoToGoogleDrive(
      buffer,
      fileName,
      file.type || "image/jpeg",
      user.name
    );

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { photo_url: driveFile.photoUrl },
      select: { id: true, photo_url: true },
    });

    return NextResponse.json({
      id: updated.id,
      photoUrl: updated.photo_url,
      driveFile,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Caricamento foto non riuscito." },
      { status: 503 }
    );
  }
}
