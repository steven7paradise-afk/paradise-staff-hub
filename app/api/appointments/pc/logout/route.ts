import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { appointmentsPcCookieName, appointmentsPcWorkerCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { appointmentSalonSlugFromName, appointmentSalonUrl } from "@/lib/appointment-salon-url";

export async function POST() {
  const jar = await cookies();
  const pc = await checkPCAuthorization(jar.get(appointmentsPcCookieName)?.value);
  const location = pc ? await prisma.location.findUnique({ where: { id: pc.locationId }, select: { name: true } }) : null;
  const salon = appointmentSalonSlugFromName(location?.name);
  const response = NextResponse.json({ redirectTo: salon ? `${appointmentSalonUrl(salon)}?choose=1` : null }, { headers: { "Cache-Control": "no-store" } });
  // Keep the device authorization; remove only the currently selected operator.
  response.cookies.set({ name: appointmentsPcWorkerCookieName, value: "", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
