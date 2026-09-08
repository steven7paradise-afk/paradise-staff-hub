import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeEndOfDayPayload } from "@/lib/end-of-day-checklist";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const adminRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);
const checklistInclude = {
  submitted_by: { select: { id: true, name: true, photo_url: true } },
  comments: {
    include: { author: { select: { id: true, name: true, photo_url: true } } },
    orderBy: { created_at: "asc" as const },
  },
};

function todayInRome() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

function operationalDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

async function notifyOtherAdmins(senderId: string, title: string, message: string, actionUrl: string) {
  const recipients = await prisma.user.findMany({
    where: { active: true, role: { in: ["ZERO", "SUPER_ADMIN", "ADMIN"] }, id: { not: senderId } },
    select: { id: true },
  });
  const createdAt = new Date();
  await createNotifications(recipients.map((recipient) => ({
    id: randomUUID(),
    user_id: recipient.id,
    title,
    message,
    type: "FINE_GIORNATA",
    page: 1,
    action_url: actionUrl,
    read: false,
    created_at: createdAt,
  })));
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !adminRoles.has(session.user.role)) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const entries = await prisma.endOfDayChecklist.findMany({
    include: checklistInclude,
    orderBy: [{ operational_date: "desc" }, { updated_at: "desc" }],
    take: 90,
  });
  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !adminRoles.has(session.user.role)) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = String(payload?.action ?? "SAVE").toUpperCase();

  if (action === "COMMENT") {
    const checklistId = String(payload?.checklistId ?? "");
    const body = String(payload?.body ?? "").trim().slice(0, 3000);
    if (!checklistId || !body) return NextResponse.json({ error: "Scrivi il commento da inviare." }, { status: 400 });
    const checklist = await prisma.endOfDayChecklist.findUnique({ where: { id: checklistId } });
    if (!checklist) return NextResponse.json({ error: "Giornata non trovata." }, { status: 404 });
    const comment = await prisma.endOfDayChecklistComment.create({
      data: { checklist_id: checklist.id, author_id: session.user.id, body },
      include: { author: { select: { id: true, name: true, photo_url: true } } },
    });
    const day = checklist.operational_date.toISOString().slice(0, 10);
    await notifyOtherAdmins(
      session.user.id,
      "Nuovo commento sulla fine giornata",
      `${session.user.name || "Un amministratore"} ha commentato la giornata del ${new Intl.DateTimeFormat("it-IT").format(checklist.operational_date)}.`,
      `/fine-giornata?entry=${encodeURIComponent(checklist.id)}`,
    );
    return NextResponse.json({ comment, day });
  }

  if (action !== "SAVE") return NextResponse.json({ error: "Azione non valida." }, { status: 400 });
  const normalized = normalizeEndOfDayPayload(payload);
  if (!normalized.data) return NextResponse.json({ error: normalized.error }, { status: 400 });
  if (normalized.data.date > todayInRome()) return NextResponse.json({ error: "Non puoi compilare una giornata futura." }, { status: 400 });
  const data = normalized.data;
  const date = operationalDate(data.date);
  const entry = await prisma.endOfDayChecklist.upsert({
    where: { operational_date: date },
    create: {
      operational_date: date,
      submitted_by_id: session.user.id,
      counts: data.counts,
      channels: data.channels,
      confirmations: data.confirmations,
      confirmation_notes: data.confirmationNotes,
      notes: data.notes || null,
      operator_one_name: data.operatorOneName,
      operator_two_name: data.operatorTwoName,
      manager_name: data.managerName,
    },
    update: {
      submitted_by_id: session.user.id,
      counts: data.counts,
      channels: data.channels,
      confirmations: data.confirmations,
      confirmation_notes: data.confirmationNotes,
      notes: data.notes || null,
      operator_one_name: data.operatorOneName,
      operator_two_name: data.operatorTwoName,
      manager_name: data.managerName,
      submitted_at: new Date(),
    },
    include: checklistInclude,
  });
  await notifyOtherAdmins(
    session.user.id,
    "Checklist di fine giornata completata",
    `${session.user.name || "Un amministratore"} ha completato la checklist del ${new Intl.DateTimeFormat("it-IT").format(date)}.`,
    `/fine-giornata?entry=${encodeURIComponent(entry.id)}`,
  );
  return NextResponse.json({ entry });
}
