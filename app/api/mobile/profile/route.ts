import { NextRequest, NextResponse } from "next/server";
import { mobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await mobileUser(request);
  const headers = { "Cache-Control": "private, no-store" };
  if (!auth) return NextResponse.json({ error: "Sessione scaduta. Accedi di nuovo." }, { status: 401, headers });
  if (auth.user.must_change_password || auth.session.device_name?.startsWith("ios-salon")) {
    return NextResponse.json({ error: "Accedi con il tuo account personale." }, { status: 403, headers });
  }
  const user = auth.user;
  const manager = user.manager_id
    ? await prisma.user.findUnique({ where: { id: user.manager_id }, select: { name: true } })
    : null;
  return NextResponse.json({
    userId: user.id,
    phone: user.whatsapp_phone,
    birthDate: user.birth_date?.toISOString().slice(0, 10) ?? null,
    fiscalCode: user.fiscal_code,
    iban: user.iban,
    contractStart: user.contract_start?.toISOString().slice(0, 10) ?? null,
    contractEnd: user.contract_end?.toISOString().slice(0, 10) ?? null,
    employeeStatus: user.employee_status,
    managerName: manager?.name ?? null,
  }, { headers });
}
