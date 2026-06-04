import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const { subscription } = await request.json();
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "Sottoscrizione non valida" }, { status: 400 });
    }

    const record = await prisma.setting.findUnique({ where: { key: "push_subscriptions" } });
    let list = Array.isArray(record?.value) ? record.value : [];

    // Remove duplicates
    list = list.filter((item: any) => item.subscription.endpoint !== subscription.endpoint);
    list.push({
      userId: session.user.id,
      subscription,
      createdAt: new Date().toISOString(),
    });

    await prisma.setting.upsert({
      where: { key: "push_subscriptions" },
      update: { value: list },
      create: { key: "push_subscriptions", value: list },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to register subscription", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
