import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedDocumentUrl } from "@/lib/supabase-storage";

const managerRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await context.params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || (document.user_id !== session.user.id && !managerRoles.has(session.user.role))) {
    return NextResponse.json({ error: "Documento non disponibile" }, { status: 404 });
  }
  if (!document.storage_path) return NextResponse.redirect(document.file_url);
  try {
    return NextResponse.redirect(await signedDocumentUrl(document.storage_path));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Download non riuscito." }, { status: 503 });
  }
}
