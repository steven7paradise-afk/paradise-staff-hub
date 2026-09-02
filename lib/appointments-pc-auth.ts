import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "./prisma";

export const appointmentsPcCookieName = "appointments_pc_token";
export const appointmentsPcWorkerCookieName = "appointments_pc_worker";
export const appointmentsPcWorkerCookieMaxAgeSeconds = 10 * 60;

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

export async function checkPCAuthorization(cookieToken: string | undefined): Promise<{ code: string; name: string; locationId: string; isPC: boolean } | null> {
  if (!cookieToken) return null;

  const accessTokenHash = hashToken(cookieToken);

  const setting = await prisma.setting.findUnique({
    where: { key: "appointments_authorized_pcs" },
  });

  const currentList = Array.isArray(setting?.value) ? (setting.value as unknown as AuthorizedPC[]) : [];
  const found = currentList.find((item) => item.accessTokenHash === accessTokenHash && item.archivedAt === null);

  if (!found) return null;

  return {
    code: found.code,
    name: found.name,
    locationId: found.locationId,
    isPC: true,
  };
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
