import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  try {
    const [count, latest] = await Promise.all([
      prisma.notification.count({ where: { user_id: session.user.id, read: false } }),
      prisma.notification.findFirst({
        where: { user_id: session.user.id, read: false },
        orderBy: { created_at: "desc" },
        select: { id: true, title: true, message: true, action_url: true, created_at: true },
      }),
    ]);

    return NextResponse.json({
      count,
      latest: latest
        ? {
            id: latest.id,
            title: latest.title,
            message: latest.message,
            actionUrl: latest.action_url,
            createdAt: latest.created_at.toISOString(),
          }
        : null,
    });
  } catch (error) {
    console.error("Latest notifications unavailable:", error);
    return NextResponse.json({ count: 0, latest: null });
  }
}
