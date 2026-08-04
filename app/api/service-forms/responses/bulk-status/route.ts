import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOperationalUser } from "@/lib/operational-session";

export async function POST(request: NextRequest) {
  const user = await getOperationalUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ids, status } = body;

    if (!Array.isArray(ids) || !status) {
      return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    }

    await prisma.serviceFormResponse.updateMany({
      where: { id: { in: ids } },
      data: { status }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Bulk update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
