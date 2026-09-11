import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveNotificationActionUrl } from "@/lib/notification-action-url";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  try {
    const [count, latest, items] = await Promise.all([
      prisma.notification.count({ where: { user_id: session.user.id, read: false } }),
      prisma.notification.findFirst({
        where: { user_id: session.user.id, read: false },
        orderBy: { created_at: "desc" },
        select: { id: true, title: true, message: true, action_url: true, created_at: true, type: true },
      }),
      prisma.notification.findMany({
        where: { user_id: session.user.id },
        take: 8,
        orderBy: { created_at: "desc" },
        select: { id: true, title: true, message: true, action_url: true, created_at: true, read: true, type: true },
      }),
    ]);

    return NextResponse.json({
      count,
      latest: latest
        ? {
            id: latest.id,
            title: latest.title,
            message: latest.message,
            actionUrl: resolveNotificationActionUrl({
              id: latest.id,
              title: latest.title,
              message: latest.message,
              type: latest.type,
              actionUrl: latest.action_url,
            }),
            createdAt: latest.created_at.toISOString(),
            type: latest.type,
          }
        : null,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        actionUrl: resolveNotificationActionUrl({
          id: item.id,
          title: item.title,
          message: item.message,
          type: item.type,
          actionUrl: item.action_url,
        }),
        createdAt: item.created_at.toISOString(),
        read: item.read,
        type: item.type,
      })),
    });
  } catch (error) {
    console.error("Latest notifications unavailable:", error);
    return NextResponse.json({ count: 0, latest: null, items: [] });
  }
}
