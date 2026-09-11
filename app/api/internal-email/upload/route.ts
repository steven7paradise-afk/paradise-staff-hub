import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadInternalEmailImageToGoogleDrive } from "@/lib/google-drive";
import { uploadSocialCover } from "@/lib/supabase-storage";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !allowedRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  }
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Seleziona un’immagine." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Sono consentite soltanto immagini." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "L’immagine supera il limite di 10 MB." }, { status: 400 });
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  try {
    const uploaded = await uploadInternalEmailImageToGoogleDrive(
      Buffer.from(await file.arrayBuffer()),
      `email-${Date.now()}-${safeName}`,
      file.type,
    );
    return NextResponse.json(uploaded);
  } catch (driveError) {
    console.warn("Internal email Drive upload fallback to Supabase", driveError);
    try {
      const previewUrl = await uploadSocialCover(session.user.id, file);
      return NextResponse.json({
        id: `supabase-${Date.now()}`,
        name: file.name,
        mimeType: file.type,
        previewUrl,
        webViewLink: previewUrl,
      });
    } catch (storageError) {
      console.error("Internal email image upload failed", storageError);
      return NextResponse.json({ error: "Impossibile caricare l’immagine. Riprova tra poco." }, { status: 500 });
    }
  }
}
