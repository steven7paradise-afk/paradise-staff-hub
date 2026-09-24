import { NextResponse } from "next/server";
import { mobileWorkspace, workspaceResponse } from "@/lib/mobile-workspace-auth";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const context = await mobileWorkspace(request);
  if (!context) return NextResponse.json({ error: "Accesso scaduto o dispositivo non autorizzato." }, { status: 401 });
  return NextResponse.json(workspaceResponse(context), { headers: { "Cache-Control": "private, no-store" } });
}
