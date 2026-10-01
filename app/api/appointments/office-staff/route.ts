import { NextRequest, NextResponse } from "next/server";
import { getOperationalUser } from "@/lib/operational-session";
import { prisma } from "@/lib/prisma";
import { isAppointmentOfficeLocation } from "@/lib/appointment-office-staff";

export async function GET(request: NextRequest) {
  const operator = await getOperationalUser(request, { requirePcWorker: true, preferAuthenticatedAdmin: true });
  if (!operator) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const profile = await prisma.user.findUnique({ where: { id: operator.id }, select: { active: true, location: { select: { name: true } } } });
  if (!profile?.active || !isAppointmentOfficeLocation(profile.location?.name)) {
    return NextResponse.json({ allowed: false, workers: [] });
  }
  const staff = await prisma.user.findMany({ where: { active: true }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, photo_url: true, role: true, location: { select: { name: true } } } });
  return NextResponse.json({ allowed: true, workers: staff.filter(person => isAppointmentOfficeLocation(person.location?.name)).map(person => ({ id: person.id, name: person.name, photoUrl: person.photo_url, role: person.role, locationName: person.location?.name })) });
}
