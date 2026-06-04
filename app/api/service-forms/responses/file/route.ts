import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { signedDocumentUrl } from "@/lib/supabase-storage";

const managerRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Percorso del file mancante" }, { status: 400 });
  }

  // Security check: Only the file owner or administrators can download the file
  const isOwner = path.startsWith(`${session.user.id}/`);
  const isAdmin = managerRoles.has(session.user.role);

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Non autorizzato ad accedere a questo file" }, { status: 403 });
  }

  try {
    const signedUrl = await signedDocumentUrl(path);
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("Failed to generate signed url for form file:", error);
    return NextResponse.json({ error: "Download del file non riuscito" }, { status: 500 });
  }
}
