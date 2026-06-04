import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const PIN_CACHE_TTL_MS = 60_000;
const workerPinCache = new Map<string, { expiresAt: number; worker: { id: string; name: string } | null }>();

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

export async function identifyWorkerByPin(pin: string, locationId: string, isOffice = false) {
  const lookup = pinLookup(pin);
  const cacheKey = `${isOffice ? "global" : locationId}:${lookup}`;
  const cached = workerPinCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.worker;
  }

  const quickMatch = await prisma.user.findFirst({
    where: {
      active: true,
      role: { not: "SUPER_ADMIN" },
      ...(isOffice ? {} : { sede_id: locationId }),
      pin_lookup: lookup,
    },
    select: { id: true, name: true, photo_url: true },
  });
  const worker = quickMatch ? { id: quickMatch.id, name: quickMatch.name, photo_url: quickMatch.photo_url } : null;
  workerPinCache.set(cacheKey, { worker, expiresAt: Date.now() + PIN_CACHE_TTL_MS });
  return worker;
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
