import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeDefaultPage } from "@/lib/default-page";
import { prisma } from "@/lib/prisma";
import { canAccess, getEffectivePermissionSet, type Role } from "@/lib/roles";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const requestedPage = normalizeDefaultPage(payload?.defaultPage);
  if (!requestedPage) {
    return NextResponse.json({ error: "Scegli una pagina iniziale valida." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Profilo non trovato." }, { status: 404 });
  }

  const permissions = await getEffectivePermissionSet(prisma, user);
  if (!canAccess(requestedPage, user.role as Role, user.mansione ?? undefined, permissions)) {
    return NextResponse.json({ error: "Non hai il permesso di aprire questa pagina." }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { default_page: requestedPage },
  });

  return NextResponse.json({ success: true, defaultPage: requestedPage });
}
