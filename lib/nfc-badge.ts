import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";

export function normalizeNfcSerial(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[\s:-]/g, "");
  if (!/^[A-Z0-9]{4,128}$/.test(normalized)) throw new Error("Tessera NFC non leggibile");
  return normalized;
}

export function nfcBadgeHash(value: unknown) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Configurazione NFC non disponibile");
  return createHmac("sha256", secret).update(`paradise-nfc-v1:${normalizeNfcSerial(value)}`).digest("hex");
}

export async function identifyWorkerByNfc(value: unknown) {
  const hash = nfcBadgeHash(value);
  return prisma.user.findFirst({
    where: {
      nfc_badge_hash: hash,
      nfc_badge_enabled: true,
      active: true,
      employee_status: { not: FORMER_EMPLOYEE_STATUS },
      role: { notIn: ["ZERO", "SUPER_ADMIN"] },
    },
    select: { id: true, name: true, photo_url: true, role: true, mansione: true },
  });
}
