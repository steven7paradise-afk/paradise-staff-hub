import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "./prisma";

export const appointmentsPcCookieName = "appointments_pc_token";
export const appointmentsPcWorkerCookieName = "appointments_pc_worker";
export const appointmentsPcWorkerCookieMaxAgeSeconds = 3 * 24 * 60 * 60;
export const appointmentsRemoteTargetCookieName = "appointments_remote_target";
export const appointmentsRemoteWorkerCookieName = "appointments_remote_worker";
export const appointmentsRemoteCookieMaxAgeSeconds = 2 * 60 * 60;

export interface AuthorizedPC {
  code: string;
  name: string;
  locationId: string;
  createdAt: string;
  activatedAt: string | null;
  accessTokenHash: string | null;
  registeredIp: string | null;
  archivedAt: string | null;
}

type PCAuthorization = { code: string; name: string; locationId: string; isPC: boolean };
const pcAuthorizationCache = new Map<string, { value: PCAuthorization; expiresAt: number }>();
const PC_AUTH_CACHE_MS = 5_000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function generateOneTimeCode(locationId: string, name: string): Promise<string> {
  const code = randomUUID();

  const setting = await prisma.setting.findUnique({
    where: { key: "appointments_authorized_pcs" },
  });

  const currentList = Array.isArray(setting?.value) ? (setting.value as unknown as AuthorizedPC[]) : [];

  const newList: AuthorizedPC[] = [
    ...currentList,
    {
      code,
      name,
      locationId,
      createdAt: new Date().toISOString(),
      activatedAt: null,
      accessTokenHash: null,
      registeredIp: null,
      archivedAt: null,
    },
  ];

  await prisma.setting.upsert({
    where: { key: "appointments_authorized_pcs" },
    update: { value: newList as any },
    create: { key: "appointments_authorized_pcs", value: newList as any },
  });

  return code;
}

export async function activatePC(code: string, ip: string | null): Promise<{ accessToken: string; name: string; locationId: string }> {
  const setting = await prisma.setting.findUnique({
    where: { key: "appointments_authorized_pcs" },
  });

  const currentList = Array.isArray(setting?.value) ? (setting.value as unknown as AuthorizedPC[]) : [];
  const index = currentList.findIndex((item) => item.code === code && item.activatedAt === null);

  if (index === -1) {
    throw new Error("Codice di attivazione non valido o già utilizzato.");
  }

  const accessToken = randomBytes(32).toString("hex");
  const accessTokenHash = hashToken(accessToken);

  currentList[index] = {
    ...currentList[index],
    activatedAt: new Date().toISOString(),
    accessTokenHash,
    registeredIp: ip,
  };

  await prisma.setting.update({
    where: { key: "appointments_authorized_pcs" },
    data: { value: currentList as any },
  });

  return {
    accessToken,
    name: currentList[index].name,
    locationId: currentList[index].locationId,
  };
}

export async function reconnectPC(code: string, ip: string | null): Promise<{ accessToken: string; name: string; locationId: string }> {
  const setting = await prisma.setting.findUnique({
    where: { key: "appointments_authorized_pcs" },
  });
  const currentList = Array.isArray(setting?.value) ? (setting.value as unknown as AuthorizedPC[]) : [];
  const index = currentList.findIndex((item) => item.code === code && item.activatedAt && !item.archivedAt);
  if (index === -1) throw new Error("PC non disponibile o non autorizzato.");

  const accessToken = randomBytes(32).toString("hex");
  if (currentList[index].accessTokenHash) pcAuthorizationCache.delete(currentList[index].accessTokenHash!);
  currentList[index] = {
    ...currentList[index],
    accessTokenHash: hashToken(accessToken),
    registeredIp: ip,
    activatedAt: new Date().toISOString(),
  };
  await prisma.setting.update({
    where: { key: "appointments_authorized_pcs" },
    data: { value: currentList as any },
  });
  return { accessToken, name: currentList[index].name, locationId: currentList[index].locationId };
}

export async function checkPCAuthorization(cookieToken: string | undefined): Promise<PCAuthorization | null> {
  if (!cookieToken) return null;

  const accessTokenHash = hashToken(cookieToken);
  const cached = pcAuthorizationCache.get(accessTokenHash);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) pcAuthorizationCache.delete(accessTokenHash);

  const setting = await prisma.setting.findUnique({
    where: { key: "appointments_authorized_pcs" },
  });

  const currentList = Array.isArray(setting?.value) ? (setting.value as unknown as AuthorizedPC[]) : [];
  const found = currentList.find((item) => item.accessTokenHash === accessTokenHash && item.archivedAt === null);

  if (!found) return null;

  const authorization = {
    code: found.code,
    name: found.name,
    locationId: found.locationId,
    isPC: true,
  };
  pcAuthorizationCache.set(accessTokenHash, { value: authorization, expiresAt: Date.now() + PC_AUTH_CACHE_MS });
  if (pcAuthorizationCache.size > 100) {
    const now = Date.now();
    for (const [key, entry] of pcAuthorizationCache) if (entry.expiresAt <= now) pcAuthorizationCache.delete(key);
  }
  return authorization;
}

export async function verifyOneTimeCode(code: string): Promise<AuthorizedPC> {
  const setting = await prisma.setting.findUnique({
    where: { key: "appointments_authorized_pcs" },
  });

  const currentList = Array.isArray(setting?.value) ? (setting.value as unknown as AuthorizedPC[]) : [];
  const pc = currentList.find((item) => item.code === code && item.activatedAt === null);

  if (!pc) {
    throw new Error("Codice di attivazione non valido o già utilizzato.");
  }

  return pc;
}
