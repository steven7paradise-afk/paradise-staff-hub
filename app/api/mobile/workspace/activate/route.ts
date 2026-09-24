import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import type { AuthorizedPC } from "@/lib/appointments-pc-auth";
import { prisma } from "@/lib/prisma";
import { appointmentSalonSlugFromName } from "@/lib/appointment-salon-url";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(code)) return NextResponse.json({ error: "Inserisci il codice o link di attivazione Salone." }, { status: 400 });
  try {
    const record = await prisma.setting.findUnique({ where: { key: "appointments_authorized_pcs" } });
    const devices = Array.isArray(record?.value) ? (record.value as unknown as AuthorizedPC[]).map((item) => ({ ...item })) : [];
    const index = devices.findIndex((item) => item.code === code && item.activatedAt === null && !item.archivedAt);
    if (index < 0) throw new Error("Codice non disponibile.");
    const enrollment = devices[index];
    const location = await prisma.location.findUnique({ where: { id: enrollment.locationId } });
    const slug = appointmentSalonSlugFromName(location?.name);
    if (!location?.active || !["buenos-aires", "duomo"].includes(slug ?? "")) {
      return NextResponse.json({ error: "Questo codice non appartiene a un salone supportato." }, { status: 400 });
    }
    const token = randomBytes(32).toString("hex");
    devices[index] = { ...enrollment, activatedAt: new Date().toISOString(),
      accessTokenHash: createHash("sha256").update(token).digest("hex"),
      registeredIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null };
    // Compare-and-swap prevents consuming one enrollment twice or overwriting a concurrent registration.
    const updated = await prisma.setting.updateMany({
      where: { key: "appointments_authorized_pcs", value: { equals: record!.value! } },
      data: { value: JSON.parse(JSON.stringify(devices)) },
    });
    if (updated.count !== 1) throw new Error("Attivazione concorrente: riprova.");
    return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Codice non valido, revocato o già utilizzato. Richiedi un nuovo link." }, { status: 410 });
  }
}
