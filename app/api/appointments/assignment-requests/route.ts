import { NextRequest, NextResponse } from "next/server";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { getOperationalUser } from "@/lib/operational-session";
import { decideAssignment } from "@/lib/client-assignment";
export async function POST(request: NextRequest) {
  const pc = await checkPCAuthorization(request.cookies.get(appointmentsPcCookieName)?.value);
  const actor = pc ? await getOperationalUser(request, { requirePcWorker: true }) : null;
  if (!pc || !actor) return NextResponse.json({ error: "Conferma il profilo alla reception." }, { status: 401 });
  const b = await request.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[a-f0-9-]{36}$/i.test(b.id) || !["approved", "rejected"].includes(b.decision)) return NextResponse.json({ error: "Decisione non valida." }, { status: 400 });
  try {
    await decideAssignment(pc.locationId, b.id, b.decision, actor);
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Richiesta cambiata. Aggiorna." }, { status: 409 }); }
}
