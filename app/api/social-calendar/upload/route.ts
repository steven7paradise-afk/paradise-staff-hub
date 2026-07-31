import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadSocialCover } from "@/lib/supabase-storage";

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
    if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Carica un'immagine valida fino a 10 MB." }, { status: 400 });
    }

    const coverUrl = await uploadSocialCover(session.user.id, file);
    return NextResponse.json({ coverUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore nel caricamento della copertina." }, { status: 500 });
  }
}
