import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export function pinLookup(pin: string) {
  return createHash("sha256").update(`paradise-staff-hub-pin-v1:${pin}`).digest("hex");
}

export async function isPinAlreadyAssigned(pin: string, excludeUserId?: string) {
  const lookup = pinLookup(pin);
  const existingLookup = await prisma.user.findFirst({
    where: {
      pin_lookup: lookup,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (existingLookup) return true;

  const users = await prisma.user.findMany({
    where: {
      pin_hash: { not: null },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { pin_hash: true },
  });
  const checks = await Promise.all(users.map((user) => bcrypt.compare(pin, user.pin_hash!)));
  return checks.some(Boolean);
}

export async function identifyWorkerByPin(pin: string, locationId: string) {
  const lookup = pinLookup(pin);
  const quickMatch = await prisma.user.findFirst({
    where: {
      active: true,
      role: { not: "SUPER_ADMIN" },
      sede_id: locationId,
      pin_lookup: lookup,
    },
    select: { id: true, name: true },
  });
  if (quickMatch) return quickMatch;

  const users = await prisma.user.findMany({
    where: { active: true, role: { not: "SUPER_ADMIN" }, sede_id: locationId, pin_hash: { not: null } },
    select: { id: true, name: true, pin_hash: true },
  });
  const checks = await Promise.all(users.map(async (user) => ({
    user,
    valid: await bcrypt.compare(pin, user.pin_hash!),
  })));
  const match = checks.find((check) => check.valid);
  if (match) {
    await prisma.user.update({ where: { id: match.user.id }, data: { pin_lookup: lookup } }).catch(() => null);
    return { id: match.user.id, name: match.user.name };
  }
  return null;
}

export async function isPinValidForUser(userId: string, pin: string, pinHash: string | null, storedLookup?: string | null) {
  const lookup = pinLookup(pin);
  if (storedLookup && storedLookup === lookup) return true;
  if (!pinHash) return false;
  const valid = await bcrypt.compare(pin, pinHash);
  if (valid) {
    await prisma.user.update({ where: { id: userId }, data: { pin_lookup: lookup } }).catch(() => null);
  }
  return valid;
}
