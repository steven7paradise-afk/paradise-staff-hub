import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFileToGoogleDrive } from "@/lib/google-drive";
import { uploadSocialCover } from "@/lib/supabase-storage";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const data = await request.formData();
    const file = data.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nessun file selezionato." }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Il file non può superare i 20 MB." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = file.name || "allegato_comunicazione";
    const mimeType = file.type || "application/octet-stream";
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");

    let url = "";

    try {
      // 1. Try uploading to Google Drive folder
      const result = await uploadFileToGoogleDrive(buffer, `comunicazioni_${Date.now()}_${fileName}`, mimeType);
      url = result.webViewLink || result.webContentLink || `https://drive.google.com/file/d/${result.id}/view`;
    } catch (driveErr) {
      console.warn("Google Drive upload fallback to Supabase storage:", driveErr);
      // 2. Fallback to Supabase Storage if Drive credentials fail
      url = await uploadSocialCover(session.user.id, file);
    }

    return NextResponse.json({
      url,
      name: fileName,
      isImage,
      isPdf,
    });
  } catch (error) {
    console.error("Failed to upload notification attachment:", error);
    return NextResponse.json({ error: "Errore durante il caricamento del file." }, { status: 500 });
  }
}
