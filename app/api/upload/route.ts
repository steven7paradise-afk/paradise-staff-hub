import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadSocialCover } from "@/lib/supabase-storage";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Carica un'immagine valida fino a 10 MB." }, { status: 400 });
    }

    // Reuse uploadSocialCover as it writes to profile-images public bucket and gets public URL
    const url = await uploadSocialCover(session.user.id, file);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Failed to upload image:", error);
    return NextResponse.json({ error: "Errore durante il caricamento del file." }, { status: 500 });
  }
}
