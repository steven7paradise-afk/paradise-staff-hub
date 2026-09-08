import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTaskView, TASK_VIEW_OPTIONS } from "@/lib/task-view";

const allowedTaskViews = new Set<string>(TASK_VIEW_OPTIONS.map((option) => option.value));

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const rawView = typeof payload?.view === "string" ? payload.view.trim().toUpperCase() : "";
  if (!allowedTaskViews.has(rawView)) {
    return NextResponse.json({ error: "Vista Task non valida." }, { status: 400 });
  }

  const view = normalizeTaskView(rawView);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { default_task_view: view },
  });

  return NextResponse.json({ success: true, view });
}
