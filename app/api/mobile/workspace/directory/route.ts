import { NextRequest, NextResponse } from "next/server";
import { mobileWorkspace } from "@/lib/mobile-workspace-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const context = await mobileWorkspace(request);
  if (!context) return NextResponse.json({ error: "Accesso scaduto." }, { status: 401 });
  const kind = request.nextUrl.searchParams.get("kind");
  if (!["employees", "locations"].includes(kind ?? "") || !context.auth || !context.modules.some((item) => item.id === kind)) {
    return NextResponse.json({ error: "Non hai accesso a questa sezione." }, { status: 403 });
  }
  const items = kind === "employees"
    ? (await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, mansione: true, role: true, location: { select: { name: true } } }, orderBy: { name: "asc" } }))
      .map((user) => ({ id: user.id, title: user.name, subtitle: user.mansione || user.role, detail: user.location?.name ?? "Sede non assegnata" }))
    : (await prisma.location.findMany({ where: { active: true }, select: { id: true, name: true, address: true, phone: true }, orderBy: { name: "asc" } }))
      .map((location) => ({ id: location.id, title: location.name, subtitle: location.address ?? "Indirizzo non disponibile", detail: location.phone ?? "" }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
