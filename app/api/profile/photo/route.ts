import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadProfileImage } from "@/lib/supabase-storage";

const photoManagerRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

function validImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (!photoManagerRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Solo admin e super admin possono modificare le foto profilo." }, { status: 403 });
  }

  const data = await request.formData();
  const file = data.get("photo");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Carica un'immagine fino a 5 MB." }, { status: 400 });
  }

  try {
    const photoUrl = await uploadProfileImage(session.user.id, file);
    await prisma.user.update({ where: { id: session.user.id }, data: { photo_url: photoUrl } });
    return NextResponse.json({ photoUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Caricamento non riuscito." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (!photoManagerRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Solo admin e super admin possono modificare le foto profilo." }, { status: 403 });
  }

  const data = await request.json();
  const photoUrl = String(data.photoUrl ?? "").trim();

  if (photoUrl && !validImageUrl(photoUrl)) {
    return NextResponse.json({ error: "Inserisci un link immagine valido." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { photo_url: photoUrl || null } });
  return NextResponse.json({ photoUrl: photoUrl || null });
}
