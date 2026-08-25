import { NextResponse } from "next/server";
import { downloadGoogleDriveFile } from "@/lib/google-drive";
import { getOperationalUser } from "@/lib/operational-session";

export async function GET(request: import("next/server").NextRequest) {
  const user = await getOperationalUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const fileId = new URL(request.url).searchParams.get("id")?.trim();
  if (!fileId) {
    return NextResponse.json({ error: "File mancante" }, { status: 400 });
  }

  try {
    const file = await downloadGoogleDriveFile(fileId);
    if (!file.mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "Il file non è una immagine" }, { status: 415 });
    }

    return new NextResponse(file.buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Immagine Drive non disponibile" },
      { status: 503 }
    );
  }
}
