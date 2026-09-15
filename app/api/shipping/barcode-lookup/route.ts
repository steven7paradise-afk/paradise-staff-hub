import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser } from "@/lib/roles";
import { normalizeInventoryCode } from "@/lib/inventory-rules";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, mansione: true, active: true },
  });
  if (!user?.active || !(await canAccessForUser(prisma, "/shipping", user))) {
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });
  }

  const code = normalizeInventoryCode(request.nextUrl.searchParams.get("code"));
  if (!code || code.length > 100) return NextResponse.json({ error: "Codice non valido" }, { status: 400 });
  const product = await prisma.inventoryProduct.findFirst({
    where: { active: true, OR: [{ barcode: code }, { sku: code }] },
    select: { name: true, barcode: true, sku: true, image_url: true },
  }).catch(() => null);
  return NextResponse.json({ product });
}
