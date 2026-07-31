import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { closeForgottenShifts } from "@/lib/forgotten-shifts";

export async function POST(request: NextRequest) {
  const session = await auth();
  const bearer = request.headers.get("authorization");
  const isCron = Boolean(process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`);
  const permittedUser = session?.user?.role === "ZERO" || session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "ADMIN";
  if (!isCron && !permittedUser) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  return NextResponse.json(await closeForgottenShifts());
}
