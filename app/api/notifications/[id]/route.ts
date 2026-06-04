import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await context.params;

  await prisma.notification.deleteMany({
    where: {
      id,
      user_id: session.user.id,
    },
  });

  return NextResponse.json({ success: true });
}
