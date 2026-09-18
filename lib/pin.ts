import bcrypt from "bcryptjs";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";

const PIN_CACHE_TTL_MS = 60_000;
type PinWorker = { id: string; name: string; photo_url: string | null; role: string; mansione: string | null };

const workerPinCache = new Map<string, {
  expiresAt: number;
  worker: PinWorker;
}>();

export function pinLookup(pin: string) {
  return createHash("sha256").update(`paradise-staff-hub-pin-v1:${pin}`).digest("hex");
}

function pinPrefixSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Configurazione PIN non disponibile");
  return secret;
}

export function pinPrefixLookup(pinOrPrefix: string) {
  const prefix = pinOrPrefix.replace(/\D/g, "").slice(0, 2);
  if (!/^\d{2}$/.test(prefix)) throw new Error("Prefisso PIN non valido");
  return createHmac("sha256", pinPrefixSecret())
    .update(`paradise-staff-hub-pin-prefix-v1:${prefix}`)
    .digest("hex");
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

function cacheWorker(lookup: string, worker: PinWorker) {
  workerPinCache.set(lookup, { worker, expiresAt: Date.now() + PIN_CACHE_TTL_MS });
  return worker;
}

export async function identifyWorkerByPin(pin: string, _locationId: string, _isOffice = false) {
  const lookup = pinLookup(pin);
  const cached = workerPinCache.get(lookup);
  if (cached && cached.expiresAt > Date.now()) {
    const stillEnabled = await prisma.user.findFirst({
      where: {
        id: cached.worker.id,
        active: true,
        employee_status: { not: FORMER_EMPLOYEE_STATUS },
        role: { notIn: ["ZERO", "SUPER_ADMIN"] },
      },
      select: { id: true },
    });
    if (stillEnabled) return cached.worker;
    workerPinCache.delete(lookup);
  }

  const quickMatch = await prisma.user.findFirst({
    where: {
      active: true,
      employee_status: { not: FORMER_EMPLOYEE_STATUS },
      role: { notIn: ["ZERO", "SUPER_ADMIN"] },
      pin_lookup: lookup,
    },
    select: { id: true, name: true, photo_url: true, role: true, mansione: true },
  });
  if (quickMatch) {
    return cacheWorker(lookup, {
      id: quickMatch.id,
      name: quickMatch.name,
      photo_url: quickMatch.photo_url,
      role: quickMatch.role,
      mansione: quickMatch.mansione,
    });
  }

  const candidates = await prisma.user.findMany({
    where: {
      active: true,
      employee_status: { not: FORMER_EMPLOYEE_STATUS },
      role: { notIn: ["ZERO", "SUPER_ADMIN"] },
      pin_hash: { not: null },
    },
    select: { id: true, name: true, photo_url: true, role: true, mansione: true, pin_hash: true },
  });

  for (const candidate of candidates) {
    if (!candidate.pin_hash) continue;
    const valid = await bcrypt.compare(pin, candidate.pin_hash);
    if (!valid) continue;

    await prisma.user.update({
      where: { id: candidate.id },
      data: { pin_lookup: lookup, pin_prefix_lookup: pinPrefixLookup(pin) },
    }).catch(() => null);
    return cacheWorker(lookup, {
      id: candidate.id,
      name: candidate.name,
      photo_url: candidate.photo_url,
      role: candidate.role,
      mansione: candidate.mansione,
    });
  }

  return null;
}

export async function isPinValidForUser(userId: string, pin: string, pinHash: string | null, storedLookup?: string | null) {
  const lookup = pinLookup(pin);
  if (storedLookup && storedLookup === lookup) return true;
  if (!pinHash) return false;
  const valid = await bcrypt.compare(pin, pinHash);
  if (valid) {
    await prisma.user.update({
      where: { id: userId },
      data: { pin_lookup: lookup, pin_prefix_lookup: pinPrefixLookup(pin) },
    }).catch(() => null);
  }
  return valid;
}

export function isPinPrefixValidForUser(pinPrefix: string, storedPrefixLookup?: string | null) {
  const prefix = pinPrefix.replace(/\D/g, "");
  if (!/^\d{2}$/.test(prefix) || !storedPrefixLookup) return false;

  const expected = Buffer.from(pinPrefixLookup(prefix), "hex");
  const stored = Buffer.from(storedPrefixLookup, "hex");
  return expected.length === stored.length && timingSafeEqual(expected, stored);
}
