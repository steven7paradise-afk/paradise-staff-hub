import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addNotificationComment,
  getNotificationComments,
  notificationCohortWhere,
  notificationThreadKey,
} from "@/lib/notification-engagement";

async function getAccessibleNotification(id: string, userId: string) {
  return prisma.notification.findFirst({
    where: { id, user_id: userId },
  });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await context.params;
  const notification = await getAccessibleNotification(id, session.user.id);
  if (!notification) return NextResponse.json({ error: "Comunicazione non trovata" }, { status: 404 });

  const [cohort, comments] = await Promise.all([
    prisma.notification.findMany({
      where: notificationCohortWhere(notification),
      select: {
        read: true,
        user: { select: { id: true, name: true, photo_url: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    getNotificationComments(notificationThreadKey(notification)),
  ]);

  return NextResponse.json({
    readers: cohort.filter((item) => item.read).map((item) => ({
      id: item.user.id,
      name: item.user.name,
      photoUrl: item.user.photo_url,
    })),
    recipientCount: cohort.length,
    comments,
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await context.params;
  const notification = await getAccessibleNotification(id, session.user.id);
  if (!notification) return NextResponse.json({ error: "Comunicazione non trovata" }, { status: 404 });

  const payload = await request.json().catch(() => ({}));
  const message = String(payload.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Scrivi un commento." }, { status: 400 });
  if (message.length > 1000) return NextResponse.json({ error: "Il commento non può superare 1000 caratteri." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, photo_url: true },
  });
  if (!user) return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });

  const comment = {
    id: randomUUID(),
    userId: user.id,
    userName: user.name,
    photoUrl: user.photo_url,
    message,
    createdAt: new Date().toISOString(),
  };
  const comments = await addNotificationComment(notificationThreadKey(notification), comment);
  return NextResponse.json({ comment, comments });
}
