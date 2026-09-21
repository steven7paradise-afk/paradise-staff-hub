import { NextRequest, NextResponse } from "next/server";
import { mobileUser, revokeMobileSession } from "@/lib/mobile-auth";

export async function GET(request: NextRequest) {
  const auth = await mobileUser(request);
  if (!auth) return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  return NextResponse.json({ authenticated: true });
}

export async function DELETE(request: NextRequest) {
  await revokeMobileSession(request);
  return NextResponse.json({ success: true });
}
