import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadCoverImage } from "@/lib/supabase-storage";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const data = await request.formData();
  const file = data.get("cover");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Carica un'immagine fino a 5 MB." }, { status: 400 });
  }

  try {
    const coverUrl = await uploadCoverImage(session.user.id, file);
    await prisma.user.update({ where: { id: session.user.id }, data: { cover_url: coverUrl } });
    return NextResponse.json({ coverUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Caricamento non riuscito." }, { status: 503 });
  }
}
