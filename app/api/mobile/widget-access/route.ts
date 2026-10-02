import { NextResponse } from "next/server";
import { mobileUser } from "@/lib/mobile-auth";
import { createWidgetAccess } from "@/lib/mobile-widget-auth";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await mobileUser(request);
  if (!auth || auth.user.must_change_password || auth.user.employee_status === "Ex dipendente" || auth.session.device_name?.startsWith("ios-salon:"))
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  return NextResponse.json({ token: await createWidgetAccess(auth.session.id), userId: auth.user.id }, { headers: { "Cache-Control": "private, no-store" } });
}
