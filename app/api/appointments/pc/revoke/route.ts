import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!dbUser || !["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(dbUser.role)) {
    return NextResponse.json({ error: "Privilegi insufficienti" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body?.code || "").trim();

    if (!code) {
      return NextResponse.json({ error: "Codice mancante." }, { status: 400 });
    }

    const setting = await prisma.setting.findUnique({
      where: { key: "appointments_authorized_pcs" },
    });

    const currentList = Array.isArray(setting?.value) ? (setting.value as any[]) : [];
    const index = currentList.findIndex((pc) => pc.code === code);

    if (index !== -1) {
      // Set archivedAt to revoke this PC session
      currentList[index].archivedAt = new Date().toISOString();
      await prisma.setting.update({
        where: { key: "appointments_authorized_pcs" },
        data: { value: currentList },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke PC error:", error);
    return NextResponse.json({ error: "Impossibile revocare l'autorizzazione." }, { status: 500 });
  }
}
