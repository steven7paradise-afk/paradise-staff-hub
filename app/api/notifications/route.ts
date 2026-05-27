import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const senderRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !senderRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json();
  const title = String(payload.title ?? "").trim();
  const message = String(payload.message ?? "").trim();
  const type = String(payload.type ?? "COMUNICAZIONE").trim() || "COMUNICAZIONE";
  const target = String(payload.target ?? "all");
  const targetId = String(payload.targetId ?? "");

  if (!title || !message) {
    return NextResponse.json({ error: "Inserisci titolo e messaggio." }, { status: 400 });
  }

  let where = {};
  if (target === "user") where = { id: targetId, active: true };
  if (target === "location") where = { sede_id: targetId, active: true };
  if (target === "all") where = { active: true };

  if (session.user.role === "RESPONSABILE") {
    where = { ...where, sede_id: session.user.sedeId, active: true };
  }

  const users = await prisma.user.findMany({ where, select: { id: true } });
  if (users.length === 0) {
    return NextResponse.json({ error: "Nessun destinatario trovato." }, { status: 400 });
  }

  await prisma.notification.createMany({
    data: users.map((user) => ({
      user_id: user.id,
      title,
      message,
      type,
      read: false,
    })),
  });

  return NextResponse.json({ sent: users.length });
}
